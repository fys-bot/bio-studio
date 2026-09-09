import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
if (fs.existsSync(".env.local") && process.loadEnvFile) process.loadEnvFile(".env.local");

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
let runtimeEnv = { ...process.env };
let workerUrl = runtimeEnv.BIOFLOW_WORKER_URL || "http://127.0.0.1:8000";
const children = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const workspaceRoot = path.resolve(process.cwd());
async function portOccupied(candidatePort) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: candidatePort });
    let settled = false;
    const finish = (occupied) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(occupied);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(900, () => finish(false));
  });
}
async function workerReady(url = workerUrl) {
  try {
    const response = await fetch(url + "/health", {
      headers: {
        "X-Bioflow-Worker-Token": runtimeEnv.BIOFLOW_WORKER_TOKEN || "local-development-only",
      },
      signal: AbortSignal.timeout(1000),
    });
    if (!response.ok) return false;
    const health = await response.json();
    return (
      health.compute === "PyDESeq2" &&
      health.apiVersion >= 2 &&
      Number(health.contractRevision || 0) >= 3 &&
      health.features?.includes("agent-plan")
    );
  } catch {
    return false;
  }
}

function listenerForPort(candidatePort) {
  return spawnSync("lsof", ["-tiTCP:" + String(candidatePort), "-sTCP:LISTEN"], {
    encoding: "utf8",
  })
    .stdout.trim()
    .split("\n")[0];
}

function listenerWorkspace(pid) {
  if (!pid) return "";
  return spawnSync("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], {
    encoding: "utf8",
  })
    .stdout.split("\n")
    .find((line) => line.startsWith("n"))
    ?.slice(1) || "";
}

async function appResponds() {
  try {
    const [sessionResponse, taskResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/api/auth/session`, {
        signal: AbortSignal.timeout(1500),
      }),
      fetch(`http://127.0.0.1:${port}/projects/proj_a5211690a4/tasks/task_demo_rnaseq`, {
        signal: AbortSignal.timeout(3000),
      }),
    ]);
    // The session route returns 401 without a token by design. The task page probe catches
    // stale webpack manifests that still serve a port but fail while installing route chunks.
    return (
      sessionResponse.status >= 100 &&
      sessionResponse.status < 600 &&
      taskResponse.ok &&
      (taskResponse.headers.get("content-type") || "").includes("text/html")
    );
  } catch {
    return false;
  }
}

async function stopStaleAppIfOwned() {
  if (!(await portOccupied(port))) return true;
  if (await appResponds()) return false;

  const listenerPid = listenerForPort(port);
  const listenerCwd = listenerWorkspace(listenerPid);
  if (!listenerPid || path.resolve(listenerCwd || "") !== workspaceRoot) {
    console.error(
      `Port ${port} is occupied by an unresponsive external service. Stop it before starting BioFlow.`,
    );
    process.exit(2);
  }

  console.warn(`Restarting stale BioFlow development server on port ${port} (PID ${listenerPid}).`);
  try {
    process.kill(Number(listenerPid), "SIGTERM");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`Cannot stop stale BioFlow server PID ${listenerPid}: ${detail}.`);
    process.exit(2);
  }
  for (let attempt = 0; attempt < 40 && (await portOccupied(port)); attempt += 1) {
    await pause(100);
  }
  if (await portOccupied(port)) {
    console.error(`Stale BioFlow server PID ${listenerPid} did not stop cleanly.`);
    process.exit(2);
  }
  return true;
}

function prepareNextCache(configuredDirectory) {
  const directory = path.resolve(workspaceRoot, configuredDirectory);
  const relative = path.relative(workspaceRoot, directory);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return;

  const fingerprint = createHash("sha256")
    .update(fs.readFileSync(path.join(workspaceRoot, "package-lock.json")))
    .update(fs.readFileSync(path.join(workspaceRoot, "node_modules", "next", "package.json")))
    .update(fs.readFileSync(path.join(workspaceRoot, "scripts", "start-demo.mjs")))
    .update(process.versions.node)
    .digest("hex");
  const marker = path.join(directory, ".bioflow-runtime-fingerprint");
  const previous = fs.existsSync(marker) ? fs.readFileSync(marker, "utf8").trim() : "";
  if (previous === fingerprint) return;

  // npm ci can replace Next's runtime while an old webpack cache remains on disk.
  // Move the old directory out of the active path first. On macOS a just-stopped Next
  // child can briefly keep a cache file open, which makes direct recursive removal flaky.
  const staleDirectory = `${directory}.stale-${Date.now()}`;
  if (fs.existsSync(directory)) fs.renameSync(directory, staleDirectory);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(marker, `${fingerprint}\n`);
  try {
    fs.rmSync(staleDirectory, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  } catch {
    console.warn(`Deferred cleanup for stale Next cache: ${path.basename(staleDirectory)}`);
  }
  console.log(`Cleared stale Next development cache: ${path.relative(workspaceRoot, directory)}`);
}
function startResearchService(env) {
  const service = spawn(process.execPath, ["scripts/start-services.mjs"], {
    stdio: "inherit",
    env,
  });
  children.push(service);
  return service;
}
async function waitForWorker(service) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await workerReady()) return true;
    if (service.exitCode !== null) return false;
    await pause(500);
  }
  return false;
}
async function fallbackWorkerPort() {
  try {
    const configured = new URL(workerUrl);
    if (!["127.0.0.1", "localhost"].includes(configured.hostname)) return undefined;
    const firstCandidate = Number(configured.port || 8000) + 1;
    for (let candidate = firstCandidate; candidate < firstCandidate + 20; candidate += 1) {
      if (!(await portOccupied(candidate))) return candidate;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function isolatedWorkerEnvironment(fallbackPort) {
  const dataDirectory = `${runtimeEnv.BIOFLOW_DATA_DIR || "data/runtime"}-worker-${fallbackPort}`;
  const qdrantPath = runtimeEnv.BIOFLOW_QDRANT_PATH
    ? `${runtimeEnv.BIOFLOW_QDRANT_PATH}-worker-${fallbackPort}`
    : `${dataDirectory}/qdrant`;
  workerUrl = `http://127.0.0.1:${fallbackPort}`;
  return {
    ...runtimeEnv,
    BIOFLOW_RESEARCH_PORT: String(fallbackPort),
    BIOFLOW_WORKER_URL: workerUrl,
    ...(runtimeEnv.QDRANT_URL
      ? {}
      : {
          BIOFLOW_DATA_DIR: dataDirectory,
          BIOFLOW_QDRANT_PATH: qdrantPath,
        }),
  };
}

if (!(await workerReady())) {
  const python = process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python";
  if (fs.existsSync(runtimeEnv.BIOFLOW_PYTHON || python)) {
    let service = startResearchService(runtimeEnv);
    let ready = await waitForWorker(service);
    if (!ready) {
      const fallbackPort = await fallbackWorkerPort();
      if (fallbackPort) {
        runtimeEnv = isolatedWorkerEnvironment(fallbackPort);
        console.warn(
          `Research Service fallback: ${workerUrl}${runtimeEnv.QDRANT_URL ? "" : ` · ${runtimeEnv.BIOFLOW_DATA_DIR}`}`,
        );
        service = startResearchService(runtimeEnv);
        ready = await waitForWorker(service);
      }
    }
    if (!ready)
      console.warn(
        "Research service unavailable. File parsing and real compute will show retryable errors.",
      );
  } else
    console.warn(
      "Research service unavailable. Install services/requirements.txt into .venv first.",
    );
}
const startApp = await stopStaleAppIfOwned();
if (!startApp) {
  console.log(
    `Port ${port} is already in use. Existing service left untouched: http://127.0.0.1:${port}`,
  );
  if (!children.length) process.exit(0);
} else {
  const nextDistDirectory = runtimeEnv.NEXT_DIST_DIR || ".next-dev";
  prepareNextCache(nextDistDirectory);
  const child = spawn("next", ["dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...runtimeEnv,
      NEXT_DIST_DIR: nextDistDirectory,
      // Recursive macOS watcher limits can leave Next aware of layout.tsx but not route files.
      // Polling trades a little CPU for deterministic discovery of the app router in this demo.
      WATCHPACK_POLLING: runtimeEnv.WATCHPACK_POLLING || "true",
      WATCHPACK_POLLING_INTERVAL: runtimeEnv.WATCHPACK_POLLING_INTERVAL || "300",
    },
  });
  children.push(child);
  child.on("exit", (code) => {
    for (const ownedChild of children) ownedChild.kill("SIGTERM");
    process.exit(code ?? 1);
  });
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    for (const child of children) child.kill(signal);
  });
