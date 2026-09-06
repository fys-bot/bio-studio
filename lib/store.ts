import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { defaultDemoConfig, DemoConfig, normalizeDemoConfig } from "./demo-config";
import type { DataFileProfile, ResearchTask, WorkflowLayoutState } from "./domain";
import {
  createDefaultWorkflowLayout,
  normalizeWorkflowLayout,
  type WorkflowLayoutInput,
} from "./workflow-layout";

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
  events: RunEvent[];
  running: boolean;
  cancelled: boolean;
  nextEvent: number;
  config: DemoConfig;
  workflowLayout?: WorkflowLayoutState;
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
  events: [],
  running: false,
  cancelled: false,
  nextEvent: 1,
  config: defaultDemoConfig,
  workflowLayout: {
    current: createDefaultWorkflowLayout(),
    versions: [],
  },
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
    } catch {
      globalStateRegistry.__bioflow = defaultState();
    }
  }
  return globalStateRegistry.__bioflow;
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

export function snapshot() {
  return state().task;
}

/** 按文件名替换最新结构摘要，持久化时不保存任何原始单元格。 */
export function saveDataFileProfile(profile: DataFileProfile) {
  const runtimeState = state();
  const existingProfiles = runtimeState.task.dataProfiles ?? [];
  runtimeState.task.dataProfiles = [
    ...existingProfiles.filter((existingProfile) => existingProfile.fileName !== profile.fileName),
    profile,
  ];
  persist(runtimeState);
  return runtimeState.task;
}

function ensureWorkflowLayout(runtimeState: BioFlowRuntimeState) {
  runtimeState.workflowLayout ??= {
    current: createDefaultWorkflowLayout(),
    versions: [],
  };
  return runtimeState.workflowLayout;
}

export function workflowLayoutSnapshot() {
  return structuredClone(ensureWorkflowLayout(state()));
}

export function saveWorkflowLayout(input: WorkflowLayoutInput) {
  const runtimeState = state();
  const workflowLayout = ensureWorkflowLayout(runtimeState);
  workflowLayout.current = normalizeWorkflowLayout(input, workflowLayout.current);
  persist(runtimeState);
  return structuredClone(workflowLayout);
}

export function createWorkflowLayoutVersion(name: string, input: WorkflowLayoutInput) {
  const runtimeState = state();
  const workflowLayout = ensureWorkflowLayout(runtimeState);
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

export function eventsAfter(eventId: number) {
  return state().events.filter((eventRecord) => eventRecord.id > eventId);
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
      if (!runtimeState.cancelled) {
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
      if (!runtimeState.cancelled) {
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
function completeArtifacts(runtimeState: BioFlowRuntimeState, runId: string) {
  const artifactCreatedAt = new Date().toISOString();
  runtimeState.task.artifacts = [
    {
      id: "artifact_volcano",
      kind: "chart",
      name: "volcano_plot.svg",
      nodeId: "volcano",
      version: "v1.0.0",
      createdAt: artifactCreatedAt,
      sourceNode: "DESeq2 差异表达",
      parameters: { "FDR 阈值": 0.05, 检测基因数: runtimeState.config.geneCount },
      summary: {
        testedGeneCount: runtimeState.config.geneCount,
        significantGeneCount: 126,
        candidateGeneCount: 18,
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
          detail: `${runtimeState.config.sampleCount} 个样本的原始计数矩阵`,
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

export function createRun() {
  const runtimeState = state();
  const runId = randomUUID();
  if (runtimeState.running) return { runId: "run_demo_001", status: "running" };
  runtimeState.running = true;
  runtimeState.cancelled = false;
  runtimeState.task.status = "running";
  persist(runtimeState);
  pushEvent(runId, "run.started", { message: "工作流已开始运行" });
  emitCode(runId);
  setTimeout(() => {
    if (runtimeState.cancelled) return;
    pushEvent(runId, "intent.detected", {
      domain: runtimeState.config.domain,
      comparison: "处理组 vs 对照组",
    });
    pushEvent(runId, "retrieval.started", {
      sources: ["项目文件", "技能包", "文献知识库"],
    });
    setTimeout(() => {
      if (runtimeState.cancelled) return;
      pushEvent(runId, "retrieval.hit", {
        projectFiles: 2,
        skills: 3,
        literature: 12,
      });
      pushEvent(runId, "evidence.reranked", { kept: 4, confidence: 0.91 });
      pushEvent(runId, "grounding.bound", {
        parameters: ["物种", "实验设计", "FDR"],
      });
    }, 280);
  }, 100);
  setTimeout(() => {
    if (runtimeState.cancelled) return;
    runtimeState.task.nodes = runtimeState.task.nodes.map((node) =>
      node.id === "design" ? { ...node, status: "running", detail: "正在校验元数据结构" } : node,
    );
    persist(runtimeState);
    pushEvent(
      runId,
      "node.updated",
      {
        status: "running",
        detail: "正在校验元数据结构",
      },
      "design",
    );
    setTimeout(() => {
      if (runtimeState.cancelled) return;
      if (runtimeState.config.failAt === "none") {
        runtimeState.task.nodes = runtimeState.task.nodes.map((node) =>
          ["design", "de", "volcano", "report"].includes(node.id)
            ? {
                ...node,
                status: "succeeded",
                detail:
                  node.id === "de"
                    ? `已检验 ${runtimeState.config.geneCount.toLocaleString()} 个基因 · FDR < 0.05`
                    : "结果已就绪",
              }
            : node,
        );
        runtimeState.task.progress = 100;
        runtimeState.task.status = "succeeded";
        completeArtifacts(runtimeState, runId);
        runtimeState.running = false;
        pushEvent(runId, "run.completed", { message: "全部结果产物已就绪" });
        persist(runtimeState);
        return;
      }
      runtimeState.task.nodes = runtimeState.task.nodes.map((node) =>
        node.id === "design" ? { ...node, status: "failed", detail: "缺少 condition 字段" } : node,
      );
      runtimeState.task.status = "failed";
      persist(runtimeState);
      pushEvent(
        runId,
        "node.updated",
        {
          status: "failed",
          error: "缺少 condition 字段",
        },
        "design",
      );
      runtimeState.running = false;
    }, runtimeState.config.runnerDelayMs);
  }, 500);
  return { runId, status: "running" };
}
export function retryNode(runId: string, nodeId: string) {
  const runtimeState = state();
  runtimeState.running = true;
  runtimeState.task.status = "running";
  runtimeState.task.nodes = runtimeState.task.nodes.map((node) =>
    node.id === nodeId
      ? { ...node, status: "succeeded", detail: "condition → 已完成映射" }
      : node.id === "de"
        ? { ...node, status: "running", detail: "正在运行 DESeq2" }
        : node,
  );
  persist(runtimeState);
  pushEvent(runId, "node.retry", { attempt: 2 }, nodeId);
  emitCode(runId);
  setTimeout(() => {
    if (runtimeState.cancelled) return;
    runtimeState.task.nodes = runtimeState.task.nodes.map((node) =>
      node.id === "de"
        ? {
            ...node,
            status: "succeeded",
            detail: "已检验 1,842 个基因 · FDR < 0.05",
          }
        : node.id === "volcano"
          ? { ...node, status: "succeeded", detail: "SVG + 交互式图表" }
          : node.id === "report"
            ? { ...node, status: "succeeded", detail: "Markdown 报告已就绪" }
            : node,
    );
    runtimeState.task.progress = 100;
    runtimeState.task.status = "succeeded";
    completeArtifacts(runtimeState, runId);
    persist(runtimeState);
    pushEvent(runId, "run.completed", { message: "全部结果产物已就绪" });
    runtimeState.running = false;
  }, 1200);
  return { runId, status: "running" };
}
export function cancelRun(runId: string) {
  const runtimeState = state();
  runtimeState.cancelled = true;
  runtimeState.running = false;
  runtimeState.task.status = "cancelled";
  runtimeState.task.nodes = runtimeState.task.nodes.map((node) =>
    node.status === "running" || node.status === "queued" ? { ...node, status: "cancelled" } : node,
  );
  persist(runtimeState);
  pushEvent(runId, "run.cancelled", { message: "Cancellation requested" });
  return { runId, status: "cancelled" };
}
export function submitClarifications(answers: Record<string, string>) {
  const runtimeState = state();
  runtimeState.task.clarification = { status: "answered", answers };
  runtimeState.task.status = "awaiting_approval";
  persist(runtimeState);
  pushEvent("planning", "plan.generated", { steps: 6, estimated: "2m 30s" });
  return runtimeState.task;
}
export function approvePlan() {
  const runtimeState = state();
  runtimeState.task.status = "queued";
  persist(runtimeState);
  pushEvent("planning", "plan.approved", { approvedBy: "demo-researcher" });
  return runtimeState.task;
}
