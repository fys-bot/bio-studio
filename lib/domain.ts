/**
 * BioFlow 工作流领域模型。
 * 页面、API 客户端和可视化组件共享这组类型，避免响应结构在各处重复声明。
 */
export type WorkflowNodeState = {
  id: string;
  label: string;
  kind: string;
  status: string;
  x: number;
  y: number;
  detail: string;
  error?: string;
};

export type ResearchTask = {
  id: string;
  title: string;
  goal: string;
  status: string;
  progress: number;
  nodes: WorkflowNodeState[];
  edges: string[][];
  artifacts: ArtifactRecord[];
};

export type ArtifactRecord = {
  id: string;
  kind: "chart" | "report" | "code";
  name: string;
  nodeId: string;
  version?: string;
  createdAt?: string;
  sourceNode?: string;
  parameters?: Record<string, string | number>;
  summary?: ArtifactSummary;
  candidateGenes?: CandidateGene[];
  lineage?: ArtifactLineageStep[];
};

/** 火山图候选基因，同时保存统计结果与稳定的可视化坐标。 */
export type CandidateGene = {
  symbol: string;
  fdr: number;
  log2FoldChange: number;
  plotX: number;
  plotY: number;
  direction: "up" | "down";
};

/** 结果面板摘要由运行结果返回，避免在组件中硬编码演示数字。 */
export type ArtifactSummary = {
  testedGeneCount: number;
  significantGeneCount: number;
  candidateGeneCount: number;
};

/** Artifact 的端到端来源链，可定位到工作流节点或证据。 */
export type ArtifactLineageStep = {
  id: string;
  label: string;
  detail: string;
  kind: "input" | "transform" | "analysis" | "evidence" | "artifact";
  nodeId?: string;
  evidenceTitle?: string;
};

export type TaskResponse = {
  task: ResearchTask;
};
