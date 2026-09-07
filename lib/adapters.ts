import type { RagTrace, StructureAdapterState } from "@/lib/domain";
import type { StructurePoint } from "@/lib/structure-model";

export type AgentRequest = {
  taskId: string;
  prompt: string;
  mode: "标准模式" | "严谨模式" | "快速模式";
};

export type AgentResponse = {
  content: string;
  traceId?: string;
  citations?: Array<{ id: string; label: string }>;
};

export interface AgentAdapter {
  respond(input: AgentRequest): Promise<AgentResponse>;
}

export interface RetrieverAdapter {
  retrieve(query: string, topK: number): Promise<RagTrace["retrievalTop20"]>;
}

export interface RerankerAdapter {
  rerank(
    query: string,
    candidates: RagTrace["retrievalTop20"],
  ): Promise<RagTrace["rerankedResults"]>;
}

export interface GraphAdapter {
  expand(query: string): Promise<RagTrace["graphRelations"]>;
}

export interface ComputeAdapter {
  run(input: {
    taskId: string;
    nodeId: string;
  }): Promise<{ status: "succeeded" | "failed"; detail: string }>;
}

export interface StructureAdapter {
  load(input: { accession: string; format: "pdb" | "cif" }): Promise<{
    state: StructureAdapterState;
    points: StructurePoint[];
  }>;
}

/**
 * 生产实现替换边界。当前各适配器由确定性演示实现提供，页面和 API 只依赖这些 DTO。
 */
export type BioFlowAdapters = {
  agent: AgentAdapter;
  retriever: RetrieverAdapter;
  reranker: RerankerAdapter;
  graph: GraphAdapter;
  compute: ComputeAdapter;
  structure: StructureAdapter;
};
