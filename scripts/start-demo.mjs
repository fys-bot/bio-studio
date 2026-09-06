import { execFileSync, spawn } from "node:child_process";

const port = Number(process.env.PORT || 3000);
const command = process.platform === "win32" ? "netstat" : "lsof";

if (process.platform !== "win32") {
  try {
    const output = execFileSync(command, ["-tiTCP:" + port, "-sTCP:LISTEN"], {
      encoding: "utf8",
    });
    const pids = output.split(/\s+/).filter(Boolean);
    pids.forEach((pid) => {
      try {
        process.kill(Number(pid), "SIGTERM");
      } catch { /* 进程可能已退出 */ }
    });
    if (pids.length) console.log(`已释放端口 ${port}：${pids.join(", ")}`);
  } catch {
    // 端口未占用时 lsof 会返回非 0，属于正常启动路径。
  }
}

const child = spawn("next", [
  "dev",
  "--hostname",
  "127.0.0.1",
  "--port",
  String(port),
], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
