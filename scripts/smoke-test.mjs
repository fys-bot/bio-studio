const base = process.argv[2] || "http://127.0.0.1:3000";
let cookie = "";

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(base + path, { ...options, headers, redirect: "manual" });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {}
  if (!response.ok)
    throw new Error(`${options.method || "GET"} ${path} -> ${response.status}: ${text}`);
  return body;
}

async function expectStatus(path, status, options = {}) {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(base + path, { ...options, headers, redirect: "manual" });
  if (response.status !== status)
    throw new Error(`${options.method || "GET"} ${path} -> ${response.status}, expected ${status}`);
  return response;
}

async function waitForTaskStatus(status, timeout = 6000) {
  const deadline = Date.now() + timeout;
  let current = null;
  while (Date.now() < deadline) {
    current = await request("/api/tasks");
    if (current.task?.status === status) return current.task;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`任务未在 ${timeout}ms 内进入 ${status}，当前为 ${current?.task?.status}`);
}

async function readEvents(runId, after = 0, duration = 1800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), duration);
  const response = await fetch(`${base}/api/runs/${runId}/events?after=${after}`, {
    headers: cookie ? { cookie } : {},
    signal: controller.signal,
  });
  if (!response.ok) throw new Error(`事件流 -> ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
    }
  } catch (error) {
    if (error?.name !== "AbortError") throw error;
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => {});
  }
  return [...buffer.matchAll(/data: (.+)\n/g)].map((match) => JSON.parse(match[1]));
}

async function preparePlan() {
  const answers = {
    format: "Count 矩阵",
    comparison: "处理组 vs 对照组",
    organism: "人类",
    deliverable: "可发表结果",
  };
  const clarification = await request("/api/tasks/task_demo_rnaseq/clarifications", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ answers }),
  });
  if (clarification.task?.status !== "awaiting_approval") throw new Error("澄清未进入待审批");
  const approved = await request("/api/workflows/workflow_demo/approve", {
    method: "POST",
    headers: { origin: base },
  });
  if (!approved.task) throw new Error("审批响应缺失");
}

async function resetAndPrepare() {
  await request("/api/tasks", { method: "POST", headers: { origin: base } });
  await preparePlan();
}

const log = (message) => console.log(`✓ ${message}`);
await expectStatus("/api/tasks", 401);
await expectStatus("/api/files/profile", 401, { method: "POST" });
await expectStatus("/api/workflows/workflow_demo/layout", 401);
await request("/api/auth/login", { method: "POST" });
log("页面、文件解析与工作流布局接口登录鉴权");
await request("/api/tasks", { method: "POST", headers: { origin: base } });
log("重置演示状态");
const initial = await request("/api/tasks");
if (!initial.task) throw new Error("任务快照缺失");
log(`读取任务：${initial.task.title}`);

await expectStatus("/api/workflows/workflow_demo/layout", 403, {
  method: "PUT",
  headers: { "content-type": "application/json", origin: "https://evil.example" },
  body: JSON.stringify({ zoom: 1.2 }),
});
const savedLayoutResponse = await request("/api/workflows/workflow_demo/layout", {
  method: "PUT",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({
    nodePositions: { design: { x: 360, y: 280 } },
    extraEdges: [["qc", "report"]],
    zoom: 1.25,
    pan: { x: 42, y: -18 },
  }),
});
if (savedLayoutResponse.layout?.current?.nodePositions?.design?.x !== 360) {
  throw new Error("工作流节点位置未保存");
}
const restoredLayoutResponse = await request("/api/workflows/workflow_demo/layout");
if (restoredLayoutResponse.layout?.current?.zoom !== 1.25) {
  throw new Error("工作流缩放比例未恢复");
}
const versionResponse = await request("/api/workflows/workflow_demo/layout", {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({
    name: "冒烟测试布局",
    ...restoredLayoutResponse.layout.current,
  }),
});
if (versionResponse.version?.name !== "冒烟测试布局") throw new Error("工作流版本名称缺失");
if (versionResponse.layout?.versions?.length !== 1) throw new Error("工作流版本未持久化");
log("工作流布局保存、刷新恢复与版本快照");

const crossOriginMetadataForm = new FormData();
crossOriginMetadataForm.append(
  "file",
  new Blob(["sample_id\tcondition\nS01\tcontrol\n"], {
    type: "text/tab-separated-values",
  }),
  "cross_origin_metadata.tsv",
);
await expectStatus("/api/files/profile", 403, {
  method: "POST",
  headers: { origin: "https://evil.example" },
  body: crossOriginMetadataForm,
});
log("文件解析接口跨域写请求被拒绝");

const metadataForm = new FormData();
metadataForm.append(
  "file",
  new Blob(
    [
      "sample_id\tcondition\tbatch\nS01\tcontrol\tB1\nS02\tcontrol\tB1\nS03\ttreated\tB2\nS04\ttreated\t\n",
    ],
    { type: "text/tab-separated-values" },
  ),
  "smoke_metadata.tsv",
);
const profileResponse = await request("/api/files/profile", {
  method: "POST",
  headers: { origin: base },
  body: metadataForm,
});
if (profileResponse.profile?.dataRole !== "sample_metadata") {
  throw new Error("元数据文件角色识别失败");
}
if (profileResponse.profile?.sampleCount !== 4) throw new Error("样本数识别失败");
if (profileResponse.profile?.recognizedFields?.condition !== "condition") {
  throw new Error("实验分组字段识别失败");
}
if (profileResponse.profile?.missingCellCount !== 1) throw new Error("缺失值统计失败");
if (profileResponse.task?.dataProfiles?.length !== 1) throw new Error("文件摘要未持久化");
log("TSV 服务端解析与字段建议");

const countMatrixForm = new FormData();
countMatrixForm.append(
  "file",
  new Blob(["gene_id,S01,S02,S03\nENSG000001,12,9,31\nENSG000002,3,5,18\n"], {
    type: "text/csv",
  }),
  "counts.csv",
);
const countMatrixResponse = await request("/api/files/profile", {
  method: "POST",
  headers: { origin: base },
  body: countMatrixForm,
});
if (countMatrixResponse.profile?.dataRole !== "count_matrix") {
  throw new Error("Count 矩阵角色识别失败");
}
if (countMatrixResponse.profile?.sampleCount !== 3) throw new Error("Count 矩阵样本数识别失败");
if (countMatrixResponse.task?.dataProfiles?.length !== 2) throw new Error("多文件摘要未持久化");
log("CSV Count 矩阵识别与样本统计");

const unsupportedFileForm = new FormData();
unsupportedFileForm.append(
  "file",
  new Blob(["not a tabular file"], { type: "text/plain" }),
  "sequence.fastq",
);
await expectStatus("/api/files/profile", 400, {
  method: "POST",
  headers: { origin: base },
  body: unsupportedFileForm,
});
log("不支持的文件类型返回 400");

await expectStatus("/api/tasks/task_demo_rnaseq/clarifications", 400, {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ answers: { format: "" } }),
});
log("错误澄清请求返回 400");
await preparePlan();
log("提交澄清并审批计划");

const config = await request("/api/demo/config");
if (config.config?.failAt !== "design") throw new Error("默认失败节点配置缺失");
log("读取演示配置");
await expectStatus("/api/demo/config", 403, {
  method: "POST",
  headers: { "content-type": "application/json", origin: "https://evil.example" },
  body: JSON.stringify({ failAt: "none" }),
});
log("跨域写请求被拒绝");
await request("/api/demo/config", {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ runnerDelayMs: 500, codeChunkMs: 1 }),
});
log("更新可配置演示参数");

const run = await request("/api/runs", { method: "POST", headers: { origin: base } });
if (!run.runId) throw new Error("运行 ID 缺失");
log(`创建失败演示运行：${run.runId}`);
const events = await readEvents(run.runId, 0, 1800);
const eventTypes = new Set(events.map((event) => event.type));
for (const type of [
  "run.started",
  "intent.detected",
  "retrieval.started",
  "retrieval.hit",
  "evidence.reranked",
  "grounding.bound",
  "code.delta",
  "code.completed",
]) {
  if (!eventTypes.has(type)) throw new Error(`缺少 SSE 事件：${type}`);
}
log(`SSE 事件完整：${[...eventTypes].join("、")}`);
const failed = await waitForTaskStatus("failed");
if (failed.nodes?.find((node) => node.id === "design")?.status !== "failed")
  throw new Error("失败节点状态缺失");
log("失败分支和失败节点可追溯");
const retry = await request(`/api/runs/${run.runId}/nodes/design/retry`, {
  method: "POST",
  headers: { origin: base },
});
if (retry.status !== "running") throw new Error("局部重试未启动");
const succeeded = await waitForTaskStatus("succeeded");
if (succeeded.artifacts?.length !== 3) throw new Error("重试后结果产物不完整");
const volcanoArtifact = succeeded.artifacts.find((artifact) => artifact.kind === "chart");
if (volcanoArtifact?.candidateGenes?.length !== 5) throw new Error("火山图候选基因不完整");
if (volcanoArtifact?.lineage?.length !== 5) throw new Error("结果血缘不完整");
if (!volcanoArtifact?.summary?.testedGeneCount) throw new Error("结果统计摘要缺失");
log("局部重试并生成 3 个结果产物");

await resetAndPrepare();
await request("/api/demo/config", {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ failAt: "none", runnerDelayMs: 500 }),
});
const successRun = await request("/api/runs", { method: "POST", headers: { origin: base } });
const directSuccess = await waitForTaskStatus("succeeded");
if (directSuccess.artifacts?.find((artifact) => artifact.kind === "chart")?.lineage?.length !== 5) {
  throw new Error("成功直达链路未生成完整结果血缘");
}
log(`成功分支完成：${successRun.runId}`);

await resetAndPrepare();
const cancelRun = await request("/api/runs", { method: "POST", headers: { origin: base } });
await request(`/api/runs/${cancelRun.runId}/cancel`, { method: "POST", headers: { origin: base } });
const cancelled = await waitForTaskStatus("cancelled");
if (cancelled.status !== "cancelled") throw new Error("取消状态未持久化");
log("取消分支完成");

await request("/api/tasks", { method: "POST", headers: { origin: base } });
console.log("冒烟测试通过");
