import { spawn } from "node:child_process";
import fs from "node:fs";
if (fs.existsSync(".env.local") && process.loadEnvFile) process.loadEnvFile(".env.local");
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
  ["-m", "uvicorn", "services.research.app:app", "--host", "127.0.0.1", "--port", "8000"],
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
