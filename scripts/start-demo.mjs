import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
if (fs.existsSync(".env.local") && process.loadEnvFile) process.loadEnvFile(".env.local");

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
let runtimeEnv = { ...process.env };
let workerUrl = runtimeEnv.BIOFLOW_WORKER_URL || "http://127.0.0.1:8000";
const children = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function portOccupied(candidatePort) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: candidatePort });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
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
      health.features?.includes("agent-plan")
    );
  } catch {
    return false;
  }
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

if (!(await workerReady())) {
  const python = process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python";
  if (fs.existsSync(runtimeEnv.BIOFLOW_PYTHON || python)) {
    let service = startResearchService(runtimeEnv);
    let ready = await waitForWorker(service);
    if (!ready) {
      const fallbackPort = await fallbackWorkerPort();
      if (fallbackPort) {
        workerUrl = `http://127.0.0.1:${fallbackPort}`;
        runtimeEnv = {
          ...runtimeEnv,
          BIOFLOW_RESEARCH_PORT: String(fallbackPort),
          BIOFLOW_WORKER_URL: workerUrl,
        };
        console.warn(`Research Service fallback: ${workerUrl}`);
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
const occupied = await portOccupied(port);
if (occupied) {
  console.log(
    `Port ${port} is already in use. Existing service left untouched: http://127.0.0.1:${port}`,
  );
  if (!children.length) process.exit(0);
} else {
  const child = spawn("next", ["dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...runtimeEnv, NEXT_DIST_DIR: runtimeEnv.NEXT_DIST_DIR || ".next-dev" },
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
