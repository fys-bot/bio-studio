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
  nodes: WorkflowNodeState[];
  edges: string[][];
  artifacts: ArtifactRecord[];
  dataProfiles?: DataFileProfile[];
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
  format: "CSV" | "TSV";
  sizeBytes: number;
  dataRole: "count_matrix" | "sample_metadata" | "tabular";
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
  status: "completed" | "running" | "failed";
  createdAt: string;
  completedAt?: string;
  durationMs: number;
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
