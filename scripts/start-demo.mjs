import { execFileSync, spawn } from "node:child_process";

const port = Number(process.env.PORT || 3000);
const command = process.platform === "win32" ? "netstat" : "lsof";

const wait = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

/**
 * 返回占用当前演示端口的监听进程。lsof 在端口空闲时以非零状态退出，
 * 因此这里将该结果归一化为空数组，避免把正常启动路径当作错误。
 */
function findListeningProcessIds() {
  try {
    return execFileSync(command, [`-tiTCP:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
    })
      .split(/\s+/)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * 等待旧开发服务真正释放套接字，消除 SIGTERM 与 Next.js 重新绑定端口之间的竞态。
 */
async function releaseOccupiedPort() {
  if (process.platform === "win32") return;

  const listeningProcessIds = findListeningProcessIds();
  if (listeningProcessIds.length === 0) return;

  for (const processId of listeningProcessIds) {
    try {
      process.kill(Number(processId), "SIGTERM");
    } catch {
      // 进程可能已在查询和发送信号之间自行退出。
    }
  }

  for (let releaseAttempt = 0; releaseAttempt < 15; releaseAttempt += 1) {
    if (findListeningProcessIds().length === 0) {
      console.log(`已释放端口 ${port}：${listeningProcessIds.join(", ")}`);
      return;
    }
    await wait(100);
  }

  const unresponsiveProcessIds = findListeningProcessIds();
  for (const processId of unresponsiveProcessIds) {
    try {
      process.kill(Number(processId), "SIGKILL");
    } catch {
      // 进程可能已在升级信号前退出。
    }
  }

  for (let releaseAttempt = 0; releaseAttempt < 15; releaseAttempt += 1) {
    if (findListeningProcessIds().length === 0) {
      console.log(`已强制释放端口 ${port}：${unresponsiveProcessIds.join(", ")}`);
      return;
    }
    await wait(100);
  }

  const remainingProcessIds = findListeningProcessIds();
  throw new Error(
    `端口 ${port} 未能在 3 秒内释放，仍被进程 ${remainingProcessIds.join(", ")} 占用。`,
  );
}

await releaseOccupiedPort();

const developmentServer = spawn(
  "next",
  ["dev", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  },
);

developmentServer.on("exit", (exitCode, terminationSignal) =>
  process.exit(terminationSignal ? 1 : (exitCode ?? 0)),
);
