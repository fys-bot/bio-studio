import { randomUUID } from "node:crypto";
import { researchJson, type ResearchDocument } from "./research-service";
import type { RagTrace } from "./domain";

export async function queryRealDocuments(query: string, fileIds: string[]): Promise<RagTrace> {
  const started = Date.now();
  const createdAt = new Date().toISOString();
  const result = await researchJson<{
    model: string;
    collection: string;
    ranking: string;
    hits: Array<{
      fileId: string;
      fileName: string;
      text: string;
      locator: string;
      chunkIndex: number;
      score: number;
      denseScore: number;
      bm25Score: number;
    }>;
  }>(
    "/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, fileIds, limit: 20 }),
    },
    120_000,
  );
  const documents: ResearchDocument[] = [];
  for (const id of fileIds)
    documents.push(await researchJson<ResearchDocument>(`/documents/${id}`));
  const chunks = result.hits.map((hit) => ({
    id: `${hit.fileId}:${hit.chunkIndex}`,
    documentId: hit.fileId,
    text: hit.text,
    tokenCount: 0,
    metadata: {
      locator: hit.locator,
      source: hit.fileName,
      embedding: result.model,
      cosine: String(hit.denseScore),
      bm25: String(hit.bm25Score),
    },
  }));
  const retrieval = result.hits.map((hit, index) => ({
    chunkId: chunks[index].id,
    documentId: hit.fileId,
    rank: index + 1,
    score: hit.score,
    retrievalMethod: "hybrid" as const,
    reason: result.ranking,
  }));
  return {
    id: `rag_${randomUUID()}`,
    query,
    normalizedQuery: query.trim(),
    status: "completed",
    createdAt,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    ingestionStages: [
      {
        key: "parse",
        label: "原文解析",
        status: "succeeded",
        detail: documents.map((doc) => doc.parser).join(" / "),
      },
      {
        key: "clean",
        label: "规范清洗",
        status: "succeeded",
        detail: "NFC、空白规范和页边重复行检查；保留数值与来源定位",
      },
      { key: "index", label: "Qdrant 索引", status: "succeeded", detail: result.model },
    ],
    indexSummary: {
      provider: "qdrant",
      collection: result.collection,
      dimensions: documents[0]?.dimensions || 384,
      indexedChunks: documents.reduce((sum, doc) => sum + (doc.chunkCount || 0), 0),
      status: "indexed",
    },
    parsedDocuments: documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      sourceType: "项目文件",
      uri: `/api/files/${doc.id}/original`,
      parser: doc.parser,
      status: "parsed",
      chunkCount: doc.chunkCount || 0,
    })),
    chunks,
    retrievalTop20: retrieval,
    rerankedResults: retrieval.map((item) => ({
      ...item,
      rerankScore: item.score,
      kept: item.rank <= 6,
      rationale: "RRF 排序；本阶段未启用 cross-encoder，不伪称精排",
    })),
    graphRelations: [],
    groundingBindings: [],
    toolCalls: [
      {
        id: "qdrant-search",
        tool: "qdrant-bm25-rrf",
        purpose: "对当前任务文件进行真实检索",
        input: { query, fileIds },
        output: { matches: result.hits.length, model: result.model, ranking: result.ranking },
        status: "succeeded",
        startedAt: createdAt,
        finishedAt: new Date().toISOString(),
      },
    ],
    finalDecision: {
      summary: result.hits.length
        ? `从 ${documents.length} 份任务文档召回 ${result.hits.length} 个真实片段。首条证据：${result.hits[0].text.slice(0, 220)}`
        : "未检索到可用片段。",
      nextAction: "核对来源后选择分析输入；检索结果不等于模型推理或统计结论",
      evidenceChunkIds: chunks.slice(0, 6).map((chunk) => chunk.id),
    },
  };
}
