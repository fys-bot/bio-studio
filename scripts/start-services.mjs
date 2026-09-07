import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawnSync } from "node:child_process";
if (fs.existsSync(".env.local") && process.loadEnvFile) process.loadEnvFile(".env.local");
const port = Number(process.env.BIOFLOW_RESEARCH_PORT || 8000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid BIOFLOW_RESEARCH_PORT");
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
    `Research Service already running on http://127.0.0.1:${port}; existing process left untouched.`,
  );
  process.exit(0);
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
const python =
  process.env.BIOFLOW_PYTHON ||
  (process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
if (!fs.existsSync(python)) {
  console.error(
    "Missing .venv. Run: python3 -m venv .venv, then .venv/bin/pip install -r services/requirements.txt",
  );
  process.exit(1);
}
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
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
