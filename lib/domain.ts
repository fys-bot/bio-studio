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
};

export type TaskResponse = {
  task: ResearchTask;
};
