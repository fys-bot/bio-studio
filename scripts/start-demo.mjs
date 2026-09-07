import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
if (fs.existsSync(".env.local") && process.loadEnvFile) process.loadEnvFile(".env.local");

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
const workerUrl = process.env.BIOFLOW_WORKER_URL || "http://127.0.0.1:8000";
const children = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function workerReady() {
  try {
    const response = await fetch(workerUrl + "/health", {
      headers: {
        "X-Bioflow-Worker-Token": process.env.BIOFLOW_WORKER_TOKEN || "local-development-only",
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
if (!(await workerReady())) {
  const python = process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python";
  if (fs.existsSync(process.env.BIOFLOW_PYTHON || python)) {
    const service = spawn(process.execPath, ["scripts/start-services.mjs"], {
      stdio: "inherit",
      env: process.env,
    });
    children.push(service);
    for (let attempt = 0; attempt < 30; attempt++) {
      if (await workerReady()) break;
      if (service.exitCode !== null) break;
      await pause(500);
    }
  } else
    console.warn(
      "Research service unavailable. Install services/requirements.txt into .venv first.",
    );
}
const occupied = await new Promise((resolve) => {
  const socket = net.connect({ host: "127.0.0.1", port });
  socket.once("connect", () => {
    socket.destroy();
    resolve(true);
  });
  socket.once("error", () => resolve(false));
});
if (occupied) {
  console.log(
    `Port ${port} is already in use. Existing service left untouched: http://127.0.0.1:${port}`,
  );
  if (!children.length) process.exit(0);
} else {
  const child = spawn("next", ["dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next-dev" },
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
