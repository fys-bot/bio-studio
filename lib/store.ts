import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { defaultDemoConfig, DemoConfig, normalizeDemoConfig } from "./demo-config";
import type {
  DataFileProfile,
  ConversationMessage,
  RagTrace,
  ResearchTask,
  TaskListItem,
  WorkflowLayoutState,
} from "./domain";
import {
  createDefaultWorkflowLayout,
  normalizeWorkflowLayout,
  type WorkflowLayoutInput,
} from "./workflow-layout";
import { createRagTrace } from "./rag";
import {
  indexCount,
  searchDocumentIndex,
  upsertDocumentIndex,
  vectorIndexDimensions,
} from "./vector-index";

export type NodeStatus = "succeeded" | "running" | "blocked" | "failed" | "queued" | "cancelled";
export type RunEvent = {
  id: number;
  runId: string;
  type: string;
  nodeId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

const initialNodes = [
  {
    id: "input",
    label: "读取 RNA-seq 计数矩阵",
    kind: "input",
    status: "succeeded" as NodeStatus,
    x: 50,
    y: 220,
    detail: "counts.csv · 24 个样本",
  },
  {
    id: "qc",
    label: "样本质量控制",
    kind: "analysis",
    status: "succeeded" as NodeStatus,
    x: 280,
    y: 120,
    detail: "2 个警告已处理",
  },
  {
    id: "design",
    label: "构建设计矩阵",
    kind: "gate",
    status: "failed" as NodeStatus,
    x: 280,
    y: 320,
    detail: "缺少 condition 列",
    error: "请映射 metadata.condition 后重试",
  },
  {
    id: "de",
    label: "DESeq2 差异表达",
    kind: "analysis",
    status: "blocked" as NodeStatus,
    x: 540,
    y: 220,
    detail: "等待上游步骤完成",
  },
  {
    id: "volcano",
    label: "火山图 · 显著基因",
    kind: "artifact",
    status: "blocked" as NodeStatus,
    x: 800,
    y: 120,
    detail: "SVG + 交互式图表",
  },
  {
    id: "report",
    label: "科研分析报告",
    kind: "artifact",
    status: "blocked" as NodeStatus,
    x: 800,
    y: 320,
    detail: "方法、结果与证据",
  },
];

type StoredResearchTask = ResearchTask & {
  clarification: { status: string; answers: Record<string, string> };
};

type BioFlowRuntimeState = {
  task: StoredResearchTask;
  taskList: TaskListItem[];
  taskRecords?: Record<string, StoredResearchTask>;
  conversations?: Record<string, ConversationMessage[]>;
  notesByTaskId?: Record<string, string>;
  runTaskIds?: Record<string, string>;
  runningRunIds?: Record<string, boolean>;
  cancelledRuns?: Record<string, boolean>;
  events: RunEvent[];
  running: boolean;
  cancelled: boolean;
  nextEvent: number;
  config: DemoConfig;
  workflowLayout?: WorkflowLayoutState;
  workflowLayouts?: Record<string, WorkflowLayoutState>;
  ragTraces: RagTrace[];
};
const globalStateRegistry = globalThis as typeof globalThis & {
  __bioflow?: BioFlowRuntimeState;
};
const statePath = path.join(process.cwd(), "data", "state.json");
const defaultState = (): BioFlowRuntimeState => ({
  task: {
    id: "task_demo_rnaseq",
    title: defaultDemoConfig.title,
    goal: defaultDemoConfig.goal,
    status: "clarifying",
    progress: 0,
    nodes: initialNodes.map((node) => ({
      ...node,
      status: node.id === "input" ? "succeeded" : "blocked",
      detail:
        node.id === "input"
          ? `counts.csv · ${defaultDemoConfig.sampleCount} 个样本`
          : "等待计划审批",
    })),
    edges: [
      ["input", "qc"],
      ["input", "design"],
      ["qc", "de"],
      ["design", "de"],
      ["de", "volcano"],
      ["de", "report"],
    ],
    artifacts: [],
    dataProfiles: [],
    clarification: { status: "pending", answers: {} },
  },
  taskList: [
    {
      id: "task_demo_rnaseq",
      title: defaultDemoConfig.title,
      status: "clarifying",
      progress: 0,
      updatedAt: new Date().toISOString(),
      hasUnreadResult: false,
    },
    {
      id: "task_literature",
      title: "文献证据图谱",
      status: "succeeded",
      progress: 100,
      updatedAt: "2026-09-05T08:00:00.000Z",
      hasUnreadResult: true,
    },
    {
      id: "task_structure",
      title: "蛋白质结构预览",
      status: "draft",
      progress: 0,
      updatedAt: "2026-09-06T08:00:00.000Z",
      hasUnreadResult: false,
    },
  ],
  taskRecords: {},
  conversations: {},
  notesByTaskId: {},
  runTaskIds: {},
  runningRunIds: {},
  cancelledRuns: {},
  events: [],
  running: false,
  cancelled: false,
  nextEvent: 1,
  config: defaultDemoConfig,
  workflowLayout: {
    current: createDefaultWorkflowLayout(),
    versions: [],
  },
  workflowLayouts: {},
  ragTraces: [],
});
function persist(runtimeState: BioFlowRuntimeState) {
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(runtimeState, null, 2));
  } catch {
    /* read-only deploys use process memory */
  }
}
function state(): BioFlowRuntimeState {
  if (!globalStateRegistry.__bioflow) {
    try {
      globalStateRegistry.__bioflow = JSON.parse(
        fs.readFileSync(statePath, "utf8"),
      ) as BioFlowRuntimeState;
      if (!globalStateRegistry.__bioflow.taskList?.length) {
        globalStateRegistry.__bioflow.taskList = defaultState().taskList;
      }
      globalStateRegistry.__bioflow.taskRecords ??= {};
      globalStateRegistry.__bioflow.conversations ??= {};
      globalStateRegistry.__bioflow.notesByTaskId ??= {};
      globalStateRegistry.__bioflow.runTaskIds ??= {};
      globalStateRegistry.__bioflow.runningRunIds ??= {};
      globalStateRegistry.__bioflow.cancelledRuns ??= {};
      globalStateRegistry.__bioflow.workflowLayouts ??= {};
      globalStateRegistry.__bioflow.ragTraces ??= [];
    } catch {
      globalStateRegistry.__bioflow = defaultState();
    }
  }
  return globalStateRegistry.__bioflow;
}

/** 保存一次完整的 RAG Trace，支持按阶段接口读取与前端审计。 */
export function createAndStoreRagTrace(
  query: string,
  taskId = state().task.id,
  context: Pick<RagTrace, "agentMode" | "reasoningEffort"> = {},
) {
  const runtimeState = state();
  const task = taskReference(taskId, runtimeState);
  const indexedChunks = searchDocumentIndex(taskId, query).map((entry) => ({
    fileName: entry.fileName,
    text: entry.text,
    score: entry.score,
  }));
  const trace = {
    ...createRagTrace(query, {
      dataProfiles: task?.dataProfiles ?? [],
      indexedChunks,
    }),
    ...context,
  };
  trace.indexSummary.dimensions = vectorIndexDimensions;
  trace.indexSummary.indexedChunks = indexCount(taskId);
  runtimeState.ragTraces = [...runtimeState.ragTraces.slice(-49), trace];
  persist(runtimeState);
  return trace;
}

export function listRagTraces() {
  return structuredClone(state().ragTraces ?? []);
}

export function saveRagTrace(trace: RagTrace) {
  const runtime = state();
  runtime.ragTraces = [...runtime.ragTraces.slice(-49), trace];
  persist(runtime);
  return trace;
}

export function getRagTrace(traceId: string) {
  return (state().ragTraces ?? []).find((trace) => trace.id === traceId);
}

export function configSnapshot() {
  return state().config ?? defaultDemoConfig;
}
export function updateDemoConfig(input: Partial<DemoConfig>) {
  const runtimeState = state();
  runtimeState.config = normalizeDemoConfig({ ...configSnapshot(), ...input });
  runtimeState.task.title = runtimeState.config.title;
  runtimeState.task.goal = runtimeState.config.goal;
  runtimeState.task.nodes = runtimeState.task.nodes.map((node) =>
    node.id === "input"
      ? { ...node, detail: `counts.csv · ${runtimeState.config.sampleCount} 个样本` }
      : node,
  );
  persist(runtimeState);
  return runtimeState.config;
}

/** 演示环境重置任务，便于每次面试从澄清步骤开始。生产环境不应暴露此能力。 */
export function resetDemoState() {
  const fresh = defaultState();
  globalStateRegistry.__bioflow = fresh;
  persist(fresh);
  return fresh.task;
}

const integrationFixtureTitle = /^(Custom skill|Real RNA-seq|Retrieval|Compute regression) \d{10}$/;

/** 清理集成测试生成的任务，保留默认演示任务和用户命名的真实任务。 */
export function cleanupIntegrationFixtures() {
  const runtimeState = state();
  const removedTaskIds = runtimeState.taskList
    .filter((task) => integrationFixtureTitle.test(task.title))
    .map((task) => task.id);
  const removedSet = new Set(removedTaskIds);
  const removedRunIds = Object.entries(runtimeState.runTaskIds ?? {})
    .filter(([, taskId]) => removedSet.has(taskId))
    .map(([runId]) => runId);
  const removedRunSet = new Set(removedRunIds);

  runtimeState.taskList = runtimeState.taskList.filter((task) => !removedSet.has(task.id));
  for (const taskId of removedTaskIds) {
    delete runtimeState.taskRecords?.[taskId];
    delete runtimeState.conversations?.[taskId];
    delete runtimeState.notesByTaskId?.[taskId];
    delete runtimeState.workflowLayouts?.[taskId];
  }
  for (const runId of removedRunIds) {
    delete runtimeState.runTaskIds?.[runId];
    delete runtimeState.runningRunIds?.[runId];
    delete runtimeState.cancelledRuns?.[runId];
  }
  runtimeState.events = runtimeState.events.filter((event) => !removedRunSet.has(event.runId));
  persist(runtimeState);
  return { removedTaskIds, remainingTaskCount: runtimeState.taskList.length };
}

export function snapshot() {
  return state().task;
}

function taskTemplateFromCard(taskCard: TaskListItem): StoredResearchTask {
  const draftTask = defaultState().task;
  return {
    ...draftTask,
    id: taskCard.id,
    title: taskCard.title,
    status: taskCard.status,
    progress: taskCard.progress,
    artifacts: [],
    dataProfiles: [],
    notes: "",
    clarification: { status: "pending", answers: {} },
  };
}

function taskReference(taskId: string, runtimeState = state()) {
  if (taskId === runtimeState.task.id) return runtimeState.task;
  runtimeState.taskRecords ??= {};
  const existingTask = runtimeState.taskRecords[taskId];
  if (existingTask) return existingTask;
  const taskCard = runtimeState.taskList.find((item) => item.id === taskId);
  if (!taskCard) return undefined;
  const createdTask = taskTemplateFromCard(taskCard);
  runtimeState.taskRecords[taskId] = createdTask;
  persist(runtimeState);
  return createdTask;
}

function syncTaskCard(runtimeState: BioFlowRuntimeState, task: ResearchTask) {
  runtimeState.taskList = runtimeState.taskList.map((item) =>
    item.id === task.id
      ? {
          ...item,
          title: task.title,
          status: task.status,
          progress: task.progress,
          updatedAt: new Date().toISOString(),
          hasUnreadResult: task.status === "succeeded" && item.hasUnreadResult,
        }
      : item,
  );
}

/** 返回路由对应的独立任务快照，避免不同任务共享主演示任务状态。 */
export function taskSnapshot(taskId: string) {
  const task = taskReference(taskId);
  return task ? structuredClone(task) : undefined;
}

export function listTaskCards() {
  const runtimeState = state();
  return runtimeState.taskList.map((item) => {
    const task = taskReference(item.id, runtimeState);
    if (!task) return item;
    return {
      ...item,
      title: task.title,
      status: task.status,
      progress: task.progress,
      updatedAt: task.id === runtimeState.task.id ? new Date().toISOString() : item.updatedAt,
      hasUnreadResult: task.status === "succeeded" ? item.hasUnreadResult : false,
    };
  });
}

export function createTaskRecord(
  title: string,
  options: Pick<ResearchTask, "skill" | "fileIds" | "executionMode"> = {},
) {
  const runtimeState = state();
  const task: TaskListItem = {
    id: `task_${randomUUID()}`,
    title: title.trim().slice(0, 80),
    status: "draft",
    progress: 0,
    updatedAt: new Date().toISOString(),
    hasUnreadResult: false,
  };
  runtimeState.taskList = [...runtimeState.taskList, task];
  runtimeState.taskRecords ??= {};
  runtimeState.taskRecords[task.id] = taskTemplateFromCard(task);
  Object.assign(runtimeState.taskRecords[task.id], options, { goal: title.trim().slice(0, 300) });
  persist(runtimeState);
  return task;
}

/** 删除任务及其会话、布局和运行状态；默认演示任务始终保留为安全回退。 */
export function deleteTaskRecord(taskId: string) {
  const runtimeState = state();
  if (taskId === "task_demo_rnaseq")
    return { deleted: false, reason: "默认 RNA-seq 演示任务不可删除" };
  if (!runtimeState.taskList.some((task) => task.id === taskId))
    return { deleted: false, reason: "任务不存在" };
  runtimeState.taskList = runtimeState.taskList.filter((task) => task.id !== taskId);
  delete runtimeState.taskRecords?.[taskId];
  delete runtimeState.conversations?.[taskId];
  delete runtimeState.notesByTaskId?.[taskId];
  delete runtimeState.workflowLayouts?.[taskId];
  const runIds = Object.entries(runtimeState.runTaskIds ?? {})
    .filter(([, linkedTaskId]) => linkedTaskId === taskId)
    .map(([runId]) => runId);
  runtimeState.cancelledRuns ??= {};
  runtimeState.runningRunIds ??= {};
  for (const runId of runIds) {
    runtimeState.cancelledRuns[runId] = true;
    runtimeState.runningRunIds[runId] = false;
    delete runtimeState.runTaskIds?.[runId];
  }
  runtimeState.events = runtimeState.events.filter((event) => !runIds.includes(event.runId));
  persist(runtimeState);
  return { deleted: true };
}

export function attachTaskFiles(taskId: string, fileIds: string[]) {
  const task = taskReference(taskId);
  if (!task) return undefined;
  task.fileIds = [...new Set([...(task.fileIds ?? []), ...fileIds])];
  persist(state());
  return structuredClone(task);
}

export function bindAnalysisJob(taskId: string, jobId: string) {
  const task = taskReference(taskId);
  if (!task) return undefined;
  task.analysisJobId = jobId;
  task.status = "running";
  task.progress = 0;
  task.artifacts = [];
  persist(state());
  return structuredClone(task);
}

export function saveTaskPlan(taskId: string, plan: ResearchTask["plan"]) {
  const task = taskReference(taskId);
  if (!task || !plan) return undefined;
  task.plan = structuredClone(plan);
  persist(state());
  return structuredClone(task);
}

export function syncAnalysisJob(taskId: string, status: string) {
  const task = taskReference(taskId);
  if (!task) return undefined;
  task.status = status;
  task.progress = status === "succeeded" ? 100 : status === "running" ? 40 : 0;
  if (status === "succeeded")
    task.nodes = task.nodes.map((node) => ({
      ...node,
      status: "succeeded",
      detail: "PyDESeq2 作业已完成",
      error: undefined,
    }));
  if (status === "failed")
    task.nodes = task.nodes.map((node) =>
      node.id === "de" ? { ...node, status: "failed", detail: "请查看真实作业错误" } : node,
    );
  syncTaskCard(state(), task);
  persist(state());
  return structuredClone(task);
}

export function conversationSnapshot(taskId: string) {
  if (!taskReference(taskId)) return undefined;
  return structuredClone(state().conversations?.[taskId] ?? []);
}

export function saveConversation(taskId: string, messages: ConversationMessage[]) {
  if (!taskReference(taskId)) return undefined;
  const runtimeState = state();
  runtimeState.conversations ??= {};
  runtimeState.conversations[taskId] = structuredClone(messages.slice(-100));
  persist(runtimeState);
  return runtimeState.conversations[taskId];
}

export function notesSnapshot(taskId: string) {
  if (!taskReference(taskId)) return undefined;
  return state().notesByTaskId?.[taskId] ?? "";
}

export function saveNotes(taskId: string, notes: string) {
  const task = taskReference(taskId);
  if (!task) return undefined;
  const runtimeState = state();
  runtimeState.notesByTaskId ??= {};
  runtimeState.notesByTaskId[taskId] = notes.slice(0, 10_000);
  task.notes = runtimeState.notesByTaskId[taskId];
  persist(runtimeState);
  return task.notes;
}

/** 按文件名替换最新结构摘要，持久化时不保存任何原始单元格。 */
export function saveDataFileProfile(
  profile: DataFileProfile,
  taskId = state().task.id,
  sourceText = "",
) {
  const runtimeState = state();
  const task = taskReference(taskId, runtimeState);
  if (!task) return undefined;
  const existingProfiles = task.dataProfiles ?? [];
  task.dataProfiles = [
    ...existingProfiles.filter((existingProfile) => existingProfile.fileName !== profile.fileName),
    profile,
  ];
  upsertDocumentIndex(taskId, profile, sourceText);
  persist(runtimeState);
  return task;
}

function ensureWorkflowLayout(runtimeState: BioFlowRuntimeState, taskId = runtimeState.task.id) {
  runtimeState.workflowLayouts ??= {};
  if (!runtimeState.workflowLayouts[taskId]) {
    runtimeState.workflowLayouts[taskId] =
      taskId === runtimeState.task.id && runtimeState.workflowLayout
        ? runtimeState.workflowLayout
        : { current: createDefaultWorkflowLayout(), versions: [] };
  }
  if (taskId === runtimeState.task.id)
    runtimeState.workflowLayout = runtimeState.workflowLayouts[taskId];
  return runtimeState.workflowLayouts[taskId];
}

export function workflowLayoutSnapshot(taskId?: string) {
  if (taskId && !taskReference(taskId)) return undefined;
  const runtimeState = state();
  return structuredClone(ensureWorkflowLayout(runtimeState, taskId));
}

export function saveWorkflowLayout(input: WorkflowLayoutInput, taskId?: string) {
  if (taskId && !taskReference(taskId)) return undefined;
  const runtimeState = state();
  const workflowLayout = ensureWorkflowLayout(runtimeState, taskId);
  workflowLayout.current = normalizeWorkflowLayout(input, workflowLayout.current);
  persist(runtimeState);
  return structuredClone(workflowLayout);
}

export function createWorkflowLayoutVersion(
  name: string,
  input: WorkflowLayoutInput,
  taskId?: string,
) {
  if (taskId && !taskReference(taskId)) return undefined;
  const runtimeState = state();
  const workflowLayout = ensureWorkflowLayout(runtimeState, taskId);
  workflowLayout.current = normalizeWorkflowLayout(input, workflowLayout.current);
  const versionNumber = workflowLayout.versions.length + 1;
  const version = {
    id: randomUUID(),
    name: name.trim().slice(0, 60) || `布局版本 ${versionNumber}`,
    createdAt: new Date().toISOString(),
    snapshot: structuredClone(workflowLayout.current),
  };
  workflowLayout.versions = [...workflowLayout.versions.slice(-9), version];
  persist(runtimeState);
  return { layout: structuredClone(workflowLayout), version };
}

export function eventsAfter(eventId: number, runId?: string) {
  return state().events.filter(
    (eventRecord) => eventRecord.id > eventId && (!runId || eventRecord.runId === runId),
  );
}
export function pushEvent(
  runId: string,
  type: string,
  payload: Record<string, unknown>,
  nodeId?: string,
) {
  const runtimeState = state();
  const event = {
    id: runtimeState.nextEvent++,
    runId,
    type,
    nodeId,
    payload,
    createdAt: new Date().toISOString(),
  };
  runtimeState.events.push(event);
  persist(runtimeState);
  return event;
}
function emitCode(runId: string) {
  const runtimeState = state();
  const codeText = `import pandas as pd\nfrom deseq2 import DESeqDataSet\n\ncounts = pd.read_csv("counts.csv")\nmetadata = pd.read_csv("sample_metadata.tsv")\n\n# Validate before execution\nassert "condition" in metadata.columns\n\nresults = run_differential_expression(counts, metadata)\n`;
  [...codeText].forEach((character, characterIndex) =>
    setTimeout(() => {
      if (!runtimeState.cancelledRuns?.[runId]) {
        pushEvent(
          runId,
          "code.delta",
          {
            artifactId: "artifact_code",
            text: character,
          },
          "de",
        );
      }
    }, characterIndex * runtimeState.config.codeChunkMs),
  );
  setTimeout(
    () => {
      if (!runtimeState.cancelledRuns?.[runId]) {
        pushEvent(
          runId,
          "code.completed",
          {
            artifactId: "artifact_code",
            characterCount: codeText.length,
          },
          "de",
        );
      }
    },
    codeText.length * runtimeState.config.codeChunkMs + 20,
  );
}

/** 两条成功路径共享同一份 Artifact 快照，保证结果版本与血缘一致。 */
function completeArtifacts(
  runtimeState: BioFlowRuntimeState,
  task: StoredResearchTask,
  runId: string,
) {
  const artifactCreatedAt = new Date().toISOString();
  const analysis = analysisInputSummary(runtimeState, task);
  task.artifacts = [
    {
      id: "artifact_volcano",
      kind: "chart",
      name: "volcano_plot.svg",
      nodeId: "volcano",
      version: "v1.0.0",
      createdAt: artifactCreatedAt,
      sourceNode: "DESeq2 差异表达",
      parameters: { "FDR 阈值": 0.05, 检测基因数: analysis.geneCount },
      summary: {
        testedGeneCount: analysis.geneCount,
        significantGeneCount: Math.max(1, Math.round(analysis.geneCount * 0.0068)),
        candidateGeneCount: Math.max(5, Math.min(18, Math.round(analysis.geneCount * 0.001))),
      },
      candidateGenes: [
        {
          symbol: "E2F1",
          fdr: 0.0004,
          log2FoldChange: 2.84,
          plotX: 223,
          plotY: 44,
          direction: "up",
        },
        {
          symbol: "CCNE2",
          fdr: 0.0012,
          log2FoldChange: 2.31,
          plotX: 206,
          plotY: 62,
          direction: "up",
        },
        {
          symbol: "CDK1",
          fdr: 0.0028,
          log2FoldChange: 2.07,
          plotX: 194,
          plotY: 78,
          direction: "up",
        },
        {
          symbol: "GADD45A",
          fdr: 0.0041,
          log2FoldChange: -1.86,
          plotX: 69,
          plotY: 91,
          direction: "down",
        },
        {
          symbol: "MKI67",
          fdr: 0.0063,
          log2FoldChange: 1.72,
          plotX: 185,
          plotY: 103,
          direction: "up",
        },
      ],
      lineage: [
        {
          id: "counts",
          label: "counts.csv",
          detail: `${analysis.sampleCount} 个样本的原始计数矩阵`,
          kind: "input",
          nodeId: "input",
        },
        {
          id: "design",
          label: "设计矩阵",
          detail: "~ condition + batch",
          kind: "transform",
          nodeId: "design",
        },
        {
          id: "method",
          label: "DESeq2",
          detail: "负二项分布模型与多重检验校正",
          kind: "analysis",
          nodeId: "de",
        },
        {
          id: "evidence",
          label: "方法证据",
          detail: "Love et al. 2014 · PMID 25516281",
          kind: "evidence",
          evidenceTitle: "Love et al. 2014 · Genome Biology",
        },
        {
          id: "volcano",
          label: "volcano_plot.svg",
          detail: "可交互火山图与候选基因 Top 5",
          kind: "artifact",
          nodeId: "volcano",
        },
      ],
    },
    {
      id: "artifact_report",
      kind: "report",
      name: "analysis_report.md",
      nodeId: "report",
      version: "v1.0.0",
      createdAt: artifactCreatedAt,
      sourceNode: "科研分析报告",
      parameters: { 交付物: "可发表结果", 证据绑定数: 4 },
    },
    {
      id: "artifact_code",
      kind: "code",
      name: "analysis.py",
      nodeId: "de",
      version: "v1.0.0",
      createdAt: artifactCreatedAt,
      sourceNode: "DESeq2 差异表达",
      parameters: { 统计模型: "DESeq2", 设计公式: "~ condition + batch" },
    },
  ];
  pushEvent(
    runId,
    "artifact.created",
    {
      name: "volcano_plot.svg",
      kind: "chart",
    },
    "volcano",
  );
}

function taskIdForRun(runtimeState: BioFlowRuntimeState, runId: string) {
  return runtimeState.runTaskIds?.[runId];
}

function analysisInputSummary(runtimeState: BioFlowRuntimeState, task: StoredResearchTask) {
  const countProfile = task.dataProfiles?.find((profile) => profile.dataRole === "count_matrix");
  const metadataProfile = task.dataProfiles?.find(
    (profile) => profile.dataRole === "sample_metadata",
  );
  return {
    geneCount: countProfile?.recordCount || runtimeState.config.geneCount,
    sampleCount: countProfile?.sampleCount || runtimeState.config.sampleCount,
    hasCondition: Boolean(metadataProfile?.recognizedFields.condition),
    hasUploadedProfiles: Boolean(task.dataProfiles?.length),
  };
}

function updateRunningFlag(runtimeState: BioFlowRuntimeState) {
  runtimeState.running = Object.values(runtimeState.runningRunIds ?? {}).some(Boolean);
}

export function createRun(taskId = state().task.id) {
  const runtimeState = state();
  const task = taskReference(taskId, runtimeState);
  if (!task) return { runId: "", status: "not_found" as const };
  const analysis = analysisInputSummary(runtimeState, task);
  runtimeState.runTaskIds ??= {};
  runtimeState.runningRunIds ??= {};
  runtimeState.cancelledRuns ??= {};
  const activeRun = Object.entries(runtimeState.runTaskIds).find(
    ([runId, activeTaskId]) =>
      activeTaskId === taskId && runtimeState.runningRunIds?.[runId] === true,
  );
  if (activeRun) return { runId: activeRun[0], status: "running" as const };
  const runId = randomUUID();
  runtimeState.runTaskIds[runId] = taskId;
  runtimeState.runningRunIds[runId] = true;
  runtimeState.cancelledRuns[runId] = false;
  updateRunningFlag(runtimeState);
  task.runId = runId;
  task.status = "running";
  task.nodes = task.nodes.map((node) =>
    node.id === "input" ? { ...node, detail: `counts.csv · ${analysis.sampleCount} 个样本` } : node,
  );
  syncTaskCard(runtimeState, task);
  persist(runtimeState);
  pushEvent(runId, "run.started", { message: "工作流已开始运行", taskId });
  const trace = createAndStoreRagTrace(task.goal, task.id);
  pushEvent(runId, "rag.trace.created", { traceId: trace.id, topK: trace.retrievalTop20.length });
  emitCode(runId);
  setTimeout(() => {
    if (runtimeState.cancelledRuns?.[runId]) return;
    pushEvent(runId, "intent.detected", {
      domain: runtimeState.config.domain,
      comparison: "处理组 vs 对照组",
    });
    pushEvent(runId, "retrieval.started", { sources: ["项目文件", "技能包", "文献知识库"] });
    setTimeout(() => {
      if (runtimeState.cancelledRuns?.[runId]) return;
      pushEvent(runId, "retrieval.hit", { projectFiles: 2, skills: 3, literature: 12 });
      pushEvent(runId, "evidence.reranked", { kept: 4, confidence: 0.91 });
      pushEvent(runId, "grounding.bound", { parameters: ["物种", "实验设计", "FDR"] });
    }, 280);
  }, 100);
  setTimeout(() => {
    if (runtimeState.cancelledRuns?.[runId]) return;
    task.nodes = task.nodes.map((node) =>
      node.id === "design" ? { ...node, status: "running", detail: "正在校验元数据结构" } : node,
    );
    persist(runtimeState);
    pushEvent(runId, "node.updated", { status: "running", detail: "正在校验元数据结构" }, "design");
    setTimeout(() => {
      if (runtimeState.cancelledRuns?.[runId]) return;
      const shouldFailDesign = analysis.hasUploadedProfiles
        ? !analysis.hasCondition
        : runtimeState.config.failAt === "design";
      if (!shouldFailDesign) {
        task.nodes = task.nodes.map((node) =>
          ["design", "de", "volcano", "report"].includes(node.id)
            ? {
                ...node,
                status: "succeeded",
                detail:
                  node.id === "de"
                    ? `已检验 ${analysis.geneCount.toLocaleString()} 个基因 · FDR < 0.05`
                    : "结果已就绪",
              }
            : node,
        );
        task.progress = 100;
        task.status = "succeeded";
        completeArtifacts(runtimeState, task, runId);
        syncTaskCard(runtimeState, task);
        runtimeState.runningRunIds![runId] = false;
        updateRunningFlag(runtimeState);
        pushEvent(runId, "run.completed", { message: "全部结果产物已就绪" });
        persist(runtimeState);
        return;
      }
      task.nodes = task.nodes.map((node) =>
        node.id === "design" ? { ...node, status: "failed", detail: "缺少 condition 字段" } : node,
      );
      task.status = "failed";
      syncTaskCard(runtimeState, task);
      persist(runtimeState);
      pushEvent(
        runId,
        "node.updated",
        { status: "failed", error: "缺少 condition 字段" },
        "design",
      );
      runtimeState.runningRunIds![runId] = false;
      updateRunningFlag(runtimeState);
    }, runtimeState.config.runnerDelayMs);
  }, 500);
  return { runId, status: "running" as const, task: structuredClone(task) };
}

export function retryNode(runId: string, nodeId: string) {
  const runtimeState = state();
  const taskId = taskIdForRun(runtimeState, runId);
  const task = taskId ? taskReference(taskId, runtimeState) : undefined;
  if (!task) return { runId, status: "not_found" as const };
  runtimeState.runningRunIds ??= {};
  runtimeState.cancelledRuns ??= {};
  runtimeState.runningRunIds[runId] = true;
  runtimeState.cancelledRuns[runId] = false;
  updateRunningFlag(runtimeState);
  task.runId = runId;
  task.status = "running";
  task.nodes = task.nodes.map((node) =>
    node.id === nodeId
      ? { ...node, status: "succeeded", detail: "condition → 已完成映射" }
      : node.id === "de"
        ? { ...node, status: "running", detail: "正在运行 DESeq2" }
        : node,
  );
  syncTaskCard(runtimeState, task);
  persist(runtimeState);
  pushEvent(runId, "node.retry", { attempt: 2 }, nodeId);
  emitCode(runId);
  setTimeout(() => {
    if (runtimeState.cancelledRuns?.[runId]) return;
    task.nodes = task.nodes.map((node) =>
      node.id === "de"
        ? { ...node, status: "succeeded", detail: "已检验 1,842 个基因 · FDR < 0.05" }
        : node.id === "volcano"
          ? { ...node, status: "succeeded", detail: "SVG + 交互式图表" }
          : node.id === "report"
            ? { ...node, status: "succeeded", detail: "Markdown 报告已就绪" }
            : node,
    );
    task.progress = 100;
    task.status = "succeeded";
    completeArtifacts(runtimeState, task, runId);
    syncTaskCard(runtimeState, task);
    persist(runtimeState);
    pushEvent(runId, "run.completed", { message: "全部结果产物已就绪" });
    runtimeState.runningRunIds![runId] = false;
    updateRunningFlag(runtimeState);
  }, 1200);
  return { runId, status: "running" as const, task: structuredClone(task) };
}

export function cancelRun(runId: string) {
  const runtimeState = state();
  const taskId = taskIdForRun(runtimeState, runId);
  const task = taskId ? taskReference(taskId, runtimeState) : undefined;
  if (!task) return { runId, status: "not_found" as const };
  runtimeState.cancelledRuns ??= {};
  runtimeState.runningRunIds ??= {};
  runtimeState.cancelledRuns[runId] = true;
  runtimeState.runningRunIds[runId] = false;
  updateRunningFlag(runtimeState);
  task.status = "cancelled";
  task.nodes = task.nodes.map((node) =>
    node.status === "running" || node.status === "queued" ? { ...node, status: "cancelled" } : node,
  );
  syncTaskCard(runtimeState, task);
  persist(runtimeState);
  pushEvent(runId, "run.cancelled", { message: "Cancellation requested", taskId: task.id });
  return { runId, status: "cancelled" as const, task: structuredClone(task) };
}

export function submitClarifications(taskId: string, answers: Record<string, string>) {
  const runtimeState = state();
  const task = taskReference(taskId, runtimeState);
  if (!task) return undefined;
  task.clarification = { status: "answered", answers };
  task.status = "awaiting_approval";
  syncTaskCard(runtimeState, task);
  persist(runtimeState);
  pushEvent(`planning:${taskId}`, "plan.generated", { steps: 6, estimated: "2m 30s", taskId });
  return structuredClone(task);
}

export function approvePlan(taskId = state().task.id) {
  const runtimeState = state();
  const task = taskReference(taskId, runtimeState);
  if (!task) return undefined;
  if (!task.plan) return undefined;
  task.status = "queued";
  syncTaskCard(runtimeState, task);
  persist(runtimeState);
  pushEvent(`planning:${taskId}`, "plan.approved", { approvedBy: "demo-researcher", taskId });
  return structuredClone(task);
}
