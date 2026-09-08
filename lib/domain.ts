import type { AgentMode, ReasoningEffort } from "./agent-mode";

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

export type WorkflowPosition = {
  x: number;
  y: number;
};

export type WorkflowLayoutSnapshot = {
  nodePositions: Record<string, WorkflowPosition>;
  extraEdges: string[][];
  zoom: number;
  pan: WorkflowPosition;
  revision: number;
  updatedAt: string;
};

export type WorkflowLayoutVersion = {
  id: string;
  name: string;
  createdAt: string;
  snapshot: WorkflowLayoutSnapshot;
};

export type WorkflowLayoutState = {
  current: WorkflowLayoutSnapshot;
  versions: WorkflowLayoutVersion[];
};

export type ResearchTask = {
  id: string;
  title: string;
  goal: string;
  status: string;
  progress: number;
  runId?: string;
  skill?: SkillRecord;
  fileIds?: string[];
  executionMode?: "real" | "demo";
  analysisJobId?: string;
  plan?: {
    title: string;
    summary: string;
    steps: Array<{ id: string; title: string; detail: string }>;
    risks: string[];
    requiredInputs: string[];
    provider: "llm" | "demo";
    model?: string;
    mode?: AgentMode;
    reasoningEffort?: ReasoningEffort;
    generatedAt: string;
  };
  notes?: string;
  clarification?: {
    status: string;
    answers: Record<string, string>;
  };
  nodes: WorkflowNodeState[];
  edges: string[][];
  artifacts: ArtifactRecord[];
  dataProfiles?: DataFileProfile[];
};

export type TaskListItem = {
  id: string;
  title: string;
  status: string;
  progress: number;
  updatedAt: string;
  hasUnreadResult: boolean;
};

/** 智能体能力目录条目，由服务端快照驱动，页面不持有固定技能数组。 */
export type SkillRecord = {
  id: string;
  name: string;
  category: string;
  description: string;
  source: "BioFlow Lab" | "Team" | "Community" | "Mine";
  enabled: boolean;
  version: string;
  updatedAt: string;
  status: "available" | "deprecated";
  inputs: string[];
  outputs: string[];
  instructions?: string;
};

/** 文件中心统一 DTO：种子资产和真实上传共享字段，但保留来源边界。 */
export type ProjectFileRecord = {
  id: string;
  name: string;
  format: string;
  role: string;
  sizeBytes: number;
  status: "ready" | "pending" | "indexed" | "failed";
  source: "demo-seed" | "user-upload";
  version: string;
  updatedAt: string;
  detail: string;
  retryable: boolean;
};

export type CatalogPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  source: "server-snapshot";
  updatedAt: string;
};

/** 对话消息携带身份、状态和 Trace 关联，避免使用位置索引表达业务状态。 */
export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  status: "sending" | "completed" | "failed" | "cancelled";
  traceId?: string;
  citations?: Array<{ id: string; label: string; detail?: string }>;
  feedback?: "up" | "down";
  model?: string;
};

export type StructureAdapterState = {
  source: "demo-canvas" | "pdb" | "cif";
  status: "ready" | "loading" | "error" | "fallback";
  accession: string;
  fileName?: string;
  message: string;
};

export type TabularColumnProfile = {
  name: string;
  inferredType: "number" | "category" | "identifier" | "date" | "text";
  missingCount: number;
  distinctCount: number;
};

export type GroupFieldCandidate = {
  columnName: string;
  distinctCount: number;
  score: number;
  reason: string;
};

/**
 * 服务端仅返回数据结构摘要，不回传原始单元格，避免研究数据在前端预览中泄露。
 */
export type DataFileProfile = {
  id: string;
  fileName: string;
  format: "CSV" | "TSV" | "TXT" | "MD" | "XLSX" | "PDF" | "DOCX";
  sizeBytes: number;
  dataRole: "count_matrix" | "sample_metadata" | "tabular" | "document";
  recordCount: number;
  sampleCount: number;
  columnCount: number;
  missingCellCount: number;
  columns: TabularColumnProfile[];
  groupCandidates: GroupFieldCandidate[];
  recognizedFields: {
    sample?: string;
    condition?: string;
  };
  status: "ready" | "needs_mapping";
  recommendations: string[];
  warnings: string[];
  analyzedAt: string;
  processing?: {
    parser: string;
    stages: Array<{
      key: "received" | "detected" | "extracted" | "cleaned" | "chunked" | "indexed";
      label: string;
      status: "succeeded" | "pending" | "failed";
      detail: string;
    }>;
    index: {
      provider: "local-vector-adapter" | "external-vector-db";
      collection: string;
      dimensions: number;
      status: "indexed" | "pending" | "failed";
      chunkCount: number;
    };
  };
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
  tasks?: TaskListItem[];
};

/** RAG 每一层都保留可审计输入、输出和耗时，供页面 Trace 面板与外部审计使用。 */
export type RagDocument = {
  id: string;
  name: string;
  sourceType: "项目文件" | "技能包" | "文献" | "知识图谱";
  uri: string;
  parser: string;
  status: "parsed" | "failed";
  chunkCount: number;
};

export type RagChunk = {
  id: string;
  documentId: string;
  text: string;
  tokenCount: number;
  metadata: Record<string, string>;
};

export type RagRetrievalResult = {
  chunkId: string;
  documentId: string;
  rank: number;
  score: number;
  retrievalMethod: "hybrid" | "keyword" | "vector";
  reason: string;
};

export type RagRerankResult = RagRetrievalResult & {
  rerankScore: number;
  kept: boolean;
  rationale: string;
};

export type RagGraphRelation = {
  source: string;
  relation: string;
  target: string;
  confidence: number;
  provenance: string;
};

export type RagGroundingBinding = {
  parameter: string;
  value: string;
  sourceChunkIds: string[];
  confidence: number;
  required: boolean;
};

export type RagToolCall = {
  id: string;
  tool: string;
  purpose: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: "succeeded" | "failed";
  startedAt: string;
  finishedAt: string;
};

export type RagTrace = {
  id: string;
  query: string;
  normalizedQuery: string;
  agentMode?: AgentMode;
  reasoningEffort?: ReasoningEffort;
  status: "completed" | "running" | "failed";
  createdAt: string;
  completedAt?: string;
  durationMs: number;
  ingestionStages: Array<{
    key: string;
    label: string;
    status: "succeeded" | "pending" | "failed";
    detail: string;
  }>;
  indexSummary: {
    provider: "local-vector-adapter" | "external-vector-db" | "qdrant";
    collection: string;
    dimensions: number;
    indexedChunks: number;
    status: "indexed" | "pending" | "failed";
  };
  parsedDocuments: RagDocument[];
  chunks: RagChunk[];
  retrievalTop20: RagRetrievalResult[];
  rerankedResults: RagRerankResult[];
  graphRelations: RagGraphRelation[];
  groundingBindings: RagGroundingBinding[];
  toolCalls: RagToolCall[];
  finalDecision: {
    summary: string;
    nextAction: string;
    evidenceChunkIds: string[];
  };
};
