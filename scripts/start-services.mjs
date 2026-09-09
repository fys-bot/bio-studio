import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawnSync } from "node:child_process";
if (fs.existsSync(".env.local") && process.loadEnvFile) process.loadEnvFile(".env.local");
const configuredPort = Number(process.env.BIOFLOW_RESEARCH_PORT || 8000);
if (!Number.isInteger(configuredPort) || configuredPort < 1 || configuredPort > 65535)
  throw new Error("Invalid BIOFLOW_RESEARCH_PORT");
let port = configuredPort;
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const portOccupied = (candidatePort = port) =>
  new Promise((resolve) => {
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
const workerToken = process.env.BIOFLOW_WORKER_TOKEN || "local-development-only";
const currentWorkerIsCompatible = async (candidatePort = port) => {
  try {
    const [response, specificationResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${candidatePort}/health`, {
        headers: { "X-Bioflow-Worker-Token": workerToken },
        signal: AbortSignal.timeout(1500),
      }),
      fetch(`http://127.0.0.1:${candidatePort}/openapi.json`, {
        headers: { "X-Bioflow-Worker-Token": workerToken },
        signal: AbortSignal.timeout(1500),
      }),
    ]);
    if (!response.ok || !specificationResponse.ok) return false;
    const [health, specification] = await Promise.all([
      response.json(),
      specificationResponse.json(),
    ]);
    return (
      health.apiVersion >= 2 &&
      Number(health.contractRevision || 0) >= 3 &&
      health.features?.includes("agent-plan") &&
      specification.paths?.["/agent/plan"] &&
      specification.paths?.["/search"] &&
      specification.paths?.["/jobs"]
    );
  } catch {
    return false;
  }
};
const findFallbackPort = async () => {
  for (const candidate of [configuredPort + 1, configuredPort + 2, configuredPort + 3]) {
    if (candidate > 65535) continue;
    if (await currentWorkerIsCompatible(candidate)) {
      console.log(
        `Research Service already running on http://127.0.0.1:${candidate}; existing process left untouched.`,
      );
      process.exit(0);
    }
    if (!(await portOccupied(candidate))) {
      port = candidate;
      console.warn(
        `[research] configured port ${configuredPort} is unavailable; starting compatible fallback on :${port}.`,
      );
      return true;
    }
  }
  return false;
};

if (await portOccupied()) {
  if (await currentWorkerIsCompatible()) {
    console.log(
      `Research Service already running on http://127.0.0.1:${port}; existing process left untouched.`,
    );
    process.exit(0);
  }
  const listenerPid = spawnSync("lsof", ["-tiTCP:" + String(port), "-sTCP:LISTEN"], {
    encoding: "utf8",
  })
    .stdout.trim()
    .split("\n")[0];
  const listenerCwd = listenerPid
    ? spawnSync("lsof", ["-a", "-p", listenerPid, "-d", "cwd", "-Fn"], {
        encoding: "utf8",
      })
        .stdout.split("\n")
        .find((line) => line.startsWith("n"))
        ?.slice(1)
    : "";
  if (!listenerPid || path.resolve(listenerCwd || "") !== path.resolve(process.cwd())) {
    if (!(await findFallbackPort())) {
      console.error(`No available Research Service port in ${configuredPort + 1}-${configuredPort + 3}.`);
      process.exit(2);
    }
  }
  if (port === configuredPort) {
    console.log(`Restarting stale Research Service on port ${port} (PID ${listenerPid}).`);
    try {
      process.kill(Number(listenerPid), "SIGTERM");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`[research] cannot stop stale PID ${listenerPid}: ${detail}`);
      if (!(await findFallbackPort())) {
        console.error(`No available Research Service port in ${configuredPort + 1}-${configuredPort + 3}.`);
        process.exit(2);
      }
    }
    for (let attempt = 0; port === configuredPort && attempt < 40 && (await portOccupied()); attempt += 1) {
      await pause(100);
    }
    if (port === configuredPort && (await portOccupied())) {
      if (!(await findFallbackPort())) {
        console.error(`Research Service PID ${listenerPid} did not stop cleanly.`);
        process.exit(2);
      }
    }
  }
}
if (!process.env.QDRANT_URL) {
  const dataRoot = path.resolve(process.env.BIOFLOW_DATA_DIR || "data/runtime");
  const qdrantPath = path.resolve(process.env.BIOFLOW_QDRANT_PATH || path.join(dataRoot, "qdrant"));
  const lockPath = path.join(qdrantPath, ".lock");
  if (fs.existsSync(lockPath)) {
    const lockOwner = spawnSync("lsof", ["-t", lockPath], { encoding: "utf8" }).stdout.trim();
    if (lockOwner) {
      console.log(
        `Qdrant Local already in use by PID ${lockOwner.split("\\n")[0]}; existing service left untouched.`,
      );
      process.exit(0);
    }
  }
}
const defaultPython = process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python";
const pythonCandidates = [
  process.env.BIOFLOW_PYTHON,
  // macOS may leave dependency files in a cloud-backed project directory as dataless. A local
  // runtime cache keeps worker startup deterministic without moving project source or data.
  process.platform === "win32" ? undefined : "/private/tmp/bioflow-studio-venv/bin/python",
  defaultPython,
].filter((candidate) => Boolean(candidate) && fs.existsSync(candidate));
const python = pythonCandidates[0];
if (!python) {
  console.error(
    "Missing Python worker runtime. Run: python3 -m venv .venv, then .venv/bin/pip install -r services/requirements.txt",
  );
  process.exit(1);
}

console.log(`[research] checking Python runtime: ${python}`);
const dependencyCheck = spawnSync(
  python,
  ["-c", "import fastapi, pypdf, qdrant_client; print('dependencies-ready')"],
  {
    encoding: "utf8",
    timeout: 12_000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  },
);
if (dependencyCheck.status !== 0) {
  const detail = `${dependencyCheck.stderr || dependencyCheck.stdout || dependencyCheck.error?.message || "unknown runtime failure"}`
    .trim()
    .slice(-900);
  console.error(`[research] Python dependency check failed: ${detail}`);
  console.error(
    "[research] Worker was not started. Repair the environment with: python3 -m venv .venv && .venv/bin/pip install -r services/requirements.txt",
  );
  process.exit(1);
}
console.log(`[research] dependencies ready; starting FastAPI, Qdrant Local and PyDESeq2 queue on :${port}`);
const child = spawn(
  python,
  ["-m", "uvicorn", "services.research.app:app", "--host", "127.0.0.1", "--port", String(port)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NO_PROXY: "127.0.0.1,localhost",
      HF_HOME: "data/runtime/models",
      MPLCONFIGDIR: "data/runtime/matplotlib",
      PYTHONDONTWRITEBYTECODE: "1",
      PYTHONUNBUFFERED: "1",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(`[research] failed to launch worker: ${error.message}`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  console.log(`[research] worker stopped${signal ? ` by ${signal}` : ""} (exit ${code ?? 1})`);
  process.exit(code ?? 1);
});
