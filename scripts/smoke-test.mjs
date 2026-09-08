const base = process.argv[2] || "http://127.0.0.1:3000";
let accessToken = "";

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(base + path, { ...options, headers, redirect: "manual" });
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {}
  if (!response.ok)
    throw new Error(`${options.method || "GET"} ${path} -> ${response.status}: ${text}`);
  if (path === "/api/auth/login" && body?.accessToken) accessToken = body.accessToken;
  return body;
}

async function expectStatus(path, status, options = {}) {
  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
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
  let response;
  try {
    response = await fetch(`${base}/api/runs/${runId}/events?after=${after}`, {
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (error?.name === "AbortError") return [];
    throw error;
  }
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
for (const routePath of [
  "/",
  "/skills",
  "/skills/single-cell",
  "/files",
  "/projects/proj_a5211690a4",
  "/projects/proj_a5211690a4/tasks/task_demo_rnaseq",
]) {
  await expectStatus(routePath, 200);
}
log("项目、任务、能力中心、技能详情和文件中心路由可访问");
const login = await request("/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ username: "researcher", password: "bioflow2026" }),
});
if (!login.accessToken || !login.authenticated) throw new Error("登录接口未返回访问令牌");
log("页面、文件解析与工作流布局接口登录鉴权");
const structure = await request("/api/structures/AF-Q01094-F1?format=pdb");
if (structure.state?.status !== "ready" || structure.state?.source !== "pdb") {
  throw new Error("PDB 结构适配器未返回 ready 状态");
}
if (!structure.points?.length) throw new Error("PDB 结构点为空");
log(`PDB 结构适配器加载：${structure.points.length} 个 Cα 点`);
const smokeTaskTitle = `Compute regression ${Math.floor(Date.now() / 1000)}`;
const createdTaskResponse = await request("/api/tasks", {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ title: smokeTaskTitle, executionMode: "demo" }),
});
const createdTask = createdTaskResponse.tasks?.find((item) => item.title === smokeTaskTitle);
if (
  !createdTask ||
  createdTaskResponse.tasks.filter((item) => item.title === smokeTaskTitle).length !== 1
) {
  throw new Error("新建任务未写入服务端任务列表");
}
const createdTaskSnapshot = await request(`/api/tasks/${createdTask.id}`);
if (
  createdTaskSnapshot.task?.id !== createdTask.id ||
  createdTaskSnapshot.task?.title !== createdTask.title
) {
  throw new Error("新建任务 URL 未返回对应任务快照");
}
log("服务端任务创建与列表快照");
const taskConversation = [
  {
    id: "smoke-user-message",
    role: "user",
    content: "任务级对话恢复",
    createdAt: new Date().toISOString(),
    status: "completed",
  },
];
const savedTaskConversation = await request(`/api/tasks/${createdTask.id}/conversation`, {
  method: "PUT",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ messages: taskConversation }),
});
if (savedTaskConversation.messages?.[0]?.content !== "任务级对话恢复") {
  throw new Error("任务级对话未保存");
}
const restoredTaskConversation = await request(`/api/tasks/${createdTask.id}/conversation`);
if (restoredTaskConversation.messages?.[0]?.id !== "smoke-user-message") {
  throw new Error("任务级对话未恢复");
}
const savedTaskNotes = await request(`/api/tasks/${createdTask.id}/notes`, {
  method: "PUT",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ notes: "任务级笔记恢复" }),
});
if (savedTaskNotes.notes !== "任务级笔记恢复") throw new Error("任务级笔记未保存");
const restoredTaskNotes = await request(`/api/tasks/${createdTask.id}/notes`);
if (restoredTaskNotes.notes !== "任务级笔记恢复") throw new Error("任务级笔记未恢复");
const taskLayout = await request(
  `/api/workflows/workflow_demo/layout?taskId=${encodeURIComponent(createdTask.id)}`,
);
if (taskLayout.layout?.current?.zoom !== 1) throw new Error("新任务默认布局缺失");
const savedTaskLayout = await request(
  `/api/workflows/workflow_demo/layout?taskId=${encodeURIComponent(createdTask.id)}`,
  {
    method: "PUT",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ zoom: 1.4, pan: { x: 12, y: 18 } }),
  },
);
if (savedTaskLayout.layout?.current?.zoom !== 1.4) throw new Error("任务级布局未保存");
const demoLayoutBeforeTaskRun = await request("/api/workflows/workflow_demo/layout");
if (demoLayoutBeforeTaskRun.layout?.current?.zoom === 1.4) {
  throw new Error("任务级布局串写入默认任务");
}
const createdTaskClarification = await request(`/api/tasks/${createdTask.id}/clarifications`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({
    answers: {
      format: "Count 矩阵",
      comparison: "处理组 vs 对照组",
      organism: "人类",
      deliverable: "可发表结果",
    },
  }),
});
if (createdTaskClarification.task?.status !== "awaiting_approval") {
  throw new Error("新建任务未进入计划审批");
}
if (process.env.BIOFLOW_SMOKE_LLM === "1") {
  const createdTaskPlan = await request("/api/agent/plan", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({
      taskId: createdTask.id,
      query: createdTaskClarification.task.goal,
      clarification: createdTaskClarification.task.clarification.answers,
      evidence: [],
    }),
  });
  if (
    createdTaskPlan.plan?.provider !== "llm" ||
    !createdTaskPlan.plan?.steps?.length ||
    createdTaskPlan.task?.plan?.provider !== "llm"
  ) {
    throw new Error("真实 LLM 计划未生成或未写入任务快照");
  }
  log("真实 LLM 计划生成与任务快照持久化");
}
const taskApproval = await request(`/api/tasks/${createdTask.id}/approve`, {
  method: "POST",
  headers: { origin: base },
});
if (taskApproval.task?.status !== "queued") throw new Error("任务级审批未保存");
const defaultTaskBeforeTaskRun = await request("/api/tasks/task_demo_rnaseq");
const taskRun = await request(`/api/runs?taskId=${encodeURIComponent(createdTask.id)}`, {
  method: "POST",
  headers: { origin: base },
});
if (!taskRun.runId) throw new Error("任务级运行 ID 缺失");
const taskRunEvents = await readEvents(taskRun.runId, 0, 3000);
if (!taskRunEvents.some((event) => event.type === "run.started")) {
  throw new Error("任务级运行事件缺失");
}
await request(`/api/runs/${taskRun.runId}/cancel`, {
  method: "POST",
  headers: { origin: base },
});
const taskAfterCancel = await request(`/api/tasks/${createdTask.id}`);
if (taskAfterCancel.task?.status !== "cancelled") throw new Error("任务级运行状态未隔离");
const defaultTaskAfterTaskRun = await request("/api/tasks/task_demo_rnaseq");
if (defaultTaskAfterTaskRun.task?.status !== defaultTaskBeforeTaskRun.task?.status) {
  throw new Error("任务级运行影响了默认任务");
}
log("任务级对话、笔记、布局、审批、运行与状态隔离");
await expectStatus("/api/tasks/task_demo_rnaseq", 409, {
  method: "DELETE",
  headers: { origin: base },
});
await expectStatus(`/api/tasks/${createdTask.id}`, 403, {
  method: "DELETE",
  headers: { origin: "https://evil.example" },
});
const deletedTask = await request(`/api/tasks/${createdTask.id}`, {
  method: "DELETE",
  headers: { origin: base },
});
if (
  deletedTask.deletedTaskId !== createdTask.id ||
  deletedTask.tasks?.some((item) => item.id === createdTask.id)
) {
  throw new Error("删除任务后列表仍保留旧任务");
}
await expectStatus(`/api/tasks/${createdTask.id}`, 404);
await expectStatus(`/api/tasks/${createdTask.id}/conversation`, 404);
log("任务删除、默认任务保护、关联数据清理与跨域保护");
const skillCatalog = await request("/api/skills");
if (skillCatalog.source !== "server-snapshot" || skillCatalog.items?.length !== 6) {
  throw new Error("能力中心服务端目录快照缺失");
}
const skillDetail = await request("/api/skills/rag-evidence");
if (skillDetail.skill?.version !== "1.8.0") throw new Error("技能详情版本缺失");
const disabledSkill = await request("/api/skills/single-cell", {
  method: "PATCH",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ enabled: false }),
});
if (disabledSkill.skill?.enabled !== false) throw new Error("技能启用状态未持久化");
await expectStatus("/api/skills/single-cell", 403, {
  method: "PATCH",
  headers: { "content-type": "application/json", origin: "https://evil.example" },
  body: JSON.stringify({ enabled: true }),
});
const fileCatalog = await request("/api/files");
if (fileCatalog.source !== "server-snapshot" || fileCatalog.items?.length < 4) {
  throw new Error("文件中心服务端目录快照缺失");
}
const reparsableFile = fileCatalog.items.find((item) => item.retryable) || fileCatalog.items[0];
if (!reparsableFile?.id) throw new Error("文件目录没有可重解析文件");
const reparsedFile = await request(`/api/files/${reparsableFile.id}/reparse`, {
  method: "POST",
  headers: { origin: base },
});
if (!reparsedFile.file || !["pending", "indexed", "ready"].includes(reparsedFile.file.status)) {
  throw new Error("文件重新解析状态未更新");
}
const protectedFile = fileCatalog.items.find((item) => item.source === "demo-seed");
if (protectedFile) {
  await expectStatus(`/api/files/${protectedFile.id}`, 409, {
    method: "DELETE",
    headers: { origin: base },
  });
}
const deleteForm = new FormData();
deleteForm.append(
  "file",
  new Blob(["BioFlow deletion contract\nThis fixture must be removed after the smoke test."], {
    type: "text/markdown",
  }),
  `delete_contract_${Date.now()}.md`,
);
const deleteFixture = await request("/api/files/profile?taskId=task_demo_rnaseq", {
  method: "POST",
  headers: { origin: base },
  body: deleteForm,
});
await expectStatus(`/api/files/${deleteFixture.profile.id}`, 403, {
  method: "DELETE",
  headers: { origin: "https://evil.example" },
});
const deletedFile = await request(`/api/files/${deleteFixture.profile.id}`, {
  method: "DELETE",
  headers: { origin: base },
});
if (deletedFile.deletedFileId !== deleteFixture.profile.id) {
  throw new Error("文件删除接口没有返回被删除的文件标识");
}
await expectStatus(`/api/files/${deleteFixture.profile.id}`, 404);
const taskAfterFileDelete = await request("/api/tasks/task_demo_rnaseq");
if (taskAfterFileDelete.task.fileIds?.includes(deleteFixture.profile.id)) {
  throw new Error("删除文件后任务仍保留旧文件绑定");
}
log("能力中心与文件中心目录、重解析、删除、任务解绑和跨域保护");
const ragQuery = await request("/api/rag/query", {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ query: "比较处理组和对照组的 RNA-seq 差异基因" }),
});
const retrieval = ragQuery.trace?.retrievalTop20 || [];
if (!retrieval.length || retrieval.length > 20) throw new Error("RAG Top 20 召回数量不正确");
if (retrieval.some((item, index) => item.rank !== index + 1)) {
  throw new Error("RAG 召回排名不连续");
}
if (!ragQuery.trace?.parsedDocuments?.length) throw new Error("RAG 来源文档缺失");
const realRag = ragQuery.trace?.indexSummary?.provider === "qdrant";
if (!realRag && ragQuery.trace?.groundingBindings?.length !== 4) {
  throw new Error("演示 RAG 参数 grounding 不完整");
}
const ragTraceId = ragQuery.trace.id;
const ragTrace = await request(`/api/rag/traces/${ragTraceId}`);
if (!ragTrace.trace?.toolCalls?.length) throw new Error("RAG 工具调用 Trace 缺失");
const ragRetrieval = await request(`/api/rag/traces/${ragTraceId}/retrieval`);
if (ragRetrieval.data?.[0]?.rank !== 1) throw new Error("RAG 分阶段检索接口缺失");
log(`RAG 全链路接口：${realRag ? "真实 Qdrant + BM25/RRF" : "演示 Top 20 + grounding"}`);
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

const documentForm = new FormData();
documentForm.append(
  "file",
  new Blob(["# 实验背景\n\n本实验比较处理组与对照组，并记录 batch 协变量。\n"], {
    type: "text/markdown",
  }),
  "research_notes.md",
);
const documentProfileResponse = await request("/api/files/profile?taskId=task_demo_rnaseq", {
  method: "POST",
  headers: { origin: base },
  body: documentForm,
});
if (documentProfileResponse.profile?.dataRole !== "document") {
  throw new Error("Markdown 文档角色识别失败");
}
if (!documentProfileResponse.profile?.recordCount) throw new Error("文档段落摘要缺失");
const documentTrace = await request("/api/rag/query?taskId=task_demo_rnaseq", {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ query: "根据实验背景确认 batch 协变量" }),
});
if (
  !documentTrace.trace?.parsedDocuments?.some((document) => document.name === "research_notes.md")
) {
  throw new Error("真实文档未进入任务 RAG Trace");
}
log("Markdown 文档服务端解析并进入任务级 RAG Trace");

for (const [fileName, content] of [
  ["broken.pdf", "%PDF-1.4\n/Type /Page"],
  ["broken.xlsx", "PK\u0003\u0004 xl/worksheets/sheet1.xml"],
]) {
  const binaryDocumentForm = new FormData();
  binaryDocumentForm.append("file", new Blob([content]), fileName);
  await expectStatus("/api/files/profile?taskId=task_demo_rnaseq", 422, {
    method: "POST",
    headers: { origin: base },
    body: binaryDocumentForm,
  });
}
log("损坏 PDF / Excel 容器被解析器拒绝");

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

await request("/api/tasks", { method: "POST", headers: { origin: base } });
log("清理输入文件后验证默认失败恢复演示");

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
