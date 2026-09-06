import { randomUUID } from "crypto";
import type {
  RagChunk,
  RagDocument,
  RagGraphRelation,
  RagGroundingBinding,
  RagRerankResult,
  RagRetrievalResult,
  RagToolCall,
  RagTrace,
} from "@/lib/domain";

const now = () => new Date().toISOString();

/**
 * 确定性 RAG 适配器：演示环境不依赖外部模型，但完整模拟生产链路的数据契约。
 * 后续只需替换各阶段实现，Trace 结构和页面无需改动。
 */
export function createRagTrace(query: string): RagTrace {
  const createdAt = now();
  const normalizedQuery = query.trim().replace(/\s+/g, " ").toLowerCase();
  const documents: RagDocument[] = [
    {
      id: "doc-project-metadata",
      name: "sample_metadata.tsv",
      sourceType: "项目文件",
      uri: "project://proj_a5211690a4/sample_metadata.tsv",
      parser: "TabularSchemaParser",
      status: "parsed",
      chunkCount: 6,
    },
    {
      id: "doc-skill-deseq2",
      name: "DESeq2 差异表达技能包 v2.1",
      sourceType: "技能包",
      uri: "skill://rnaseq/deseq2/v2.1",
      parser: "MarkdownSkillParser",
      status: "parsed",
      chunkCount: 8,
    },
    {
      id: "doc-love-2014",
      name: "Love et al. 2014 · Genome Biology",
      sourceType: "文献",
      uri: "pmid://25516281",
      parser: "PublicationParser",
      status: "parsed",
      chunkCount: 5,
    },
    {
      id: "doc-reactome-cycle",
      name: "Reactome · Cell Cycle Pathway",
      sourceType: "知识图谱",
      uri: "graph://reactome/R-HSA-69278",
      parser: "GraphSnapshotParser",
      status: "parsed",
      chunkCount: 4,
    },
  ];

  const chunkTexts = [
    [
      "doc-project-metadata",
      "condition 字段包含 control 与 treated 两个水平，batch 可作为协变量。",
    ],
    ["doc-project-metadata", "样本元数据与 Count 矩阵通过 sample_id 进行一对一校验。"],
    ["doc-skill-deseq2", "DESeq2 使用负二项分布模型，并通过 Benjamini-Hochberg 控制 FDR。"],
    ["doc-skill-deseq2", "设计公式建议为 ~ condition + batch，比较 treated 相对于 control。"],
    ["doc-love-2014", "Love 等人在 Genome Biology 2014 介绍了 DESeq2 的统计框架与归一化策略。"],
    ["doc-love-2014", "低计数过滤与多重检验校正应在差异表达结果解释前完成。"],
    ["doc-reactome-cycle", "细胞周期通路关联 TP53、CDK1、CCNB1 等候选基因。"],
    ["doc-reactome-cycle", "通路关系用于结果排序与解释，不替代统计显著性判断。"],
  ] as const;
  const chunks: RagChunk[] = chunkTexts.map(([documentId, text], index) => ({
    id: `chunk-${index + 1}`,
    documentId,
    text,
    tokenCount: text.length,
    metadata: { stage: "chunking", language: "zh-CN" },
  }));

  const retrievalTop20: RagRetrievalResult[] = chunks
    .map((chunk, index) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      rank: index + 1,
      score: Number((0.99 - index * 0.045).toFixed(3)),
      retrievalMethod: (index < 4 ? "hybrid" : index < 6 ? "keyword" : "vector") as
        | "hybrid"
        | "keyword"
        | "vector",
      reason: index < 4 ? "关键词 + 向量共同命中" : "语义相似度命中",
    }))
    .concat(
      Array.from({ length: 12 }, (_, index) => ({
        chunkId: `candidate-${index + 1}`,
        documentId: documents[index % documents.length].id,
        rank: chunks.length + index + 1,
        score: Number((0.62 - index * 0.018).toFixed(3)),
        retrievalMethod: "vector" as const,
        reason: "向量召回候选",
      })),
    );

  const rerankedResults: RagRerankResult[] = retrievalTop20.map((item, index) => ({
    ...item,
    rerankScore: Number(Math.max(0.31, item.score - index * 0.008).toFixed(3)),
    kept: index < 6,
    rationale:
      index < 6 ? "与问题实体、实验设计和工具参数直接相关" : "保留为审计候选，未进入上下文",
  }));

  const graphRelations: RagGraphRelation[] = [
    {
      source: "treated vs control",
      relation: "映射到",
      target: "~ condition + batch",
      confidence: 0.98,
      provenance: "chunk-1 / chunk-4",
    },
    {
      source: "DESeq2",
      relation: "依据",
      target: "Love et al. 2014",
      confidence: 0.96,
      provenance: "chunk-3 / chunk-5",
    },
    {
      source: "细胞周期",
      relation: "关联",
      target: "TP53 · CDK1 · CCNB1",
      confidence: 0.87,
      provenance: "chunk-7",
    },
  ];

  const groundingBindings: RagGroundingBinding[] = [
    {
      parameter: "物种",
      value: "人类（Homo sapiens）",
      sourceChunkIds: ["chunk-1"],
      confidence: 0.92,
      required: true,
    },
    {
      parameter: "设计公式",
      value: "~ condition + batch",
      sourceChunkIds: ["chunk-1", "chunk-4"],
      confidence: 0.98,
      required: true,
    },
    {
      parameter: "比较方向",
      value: "treated vs control",
      sourceChunkIds: ["chunk-1", "chunk-4"],
      confidence: 0.97,
      required: true,
    },
    {
      parameter: "FDR 阈值",
      value: "0.05（Benjamini-Hochberg）",
      sourceChunkIds: ["chunk-3", "chunk-6"],
      confidence: 0.95,
      required: true,
    },
  ];

  const started = Date.now();
  const toolCalls: RagToolCall[] = [
    {
      id: "tool-parse",
      tool: "parse_tabular_schema",
      purpose: "解析项目文件字段与样本关系",
      input: { files: ["sample_metadata.tsv", "counts.csv"] },
      output: { columns: ["sample_id", "condition", "batch"], sampleCount: 24, missingCells: 0 },
      status: "succeeded",
      startedAt: createdAt,
      finishedAt: now(),
    },
    {
      id: "tool-retrieve",
      tool: "hybrid_retrieval",
      purpose: "混合召回并返回 Top 20",
      input: { query: normalizedQuery, topK: 20, filters: { projectId: "proj_a5211690a4" } },
      output: { returned: 20, sources: 4 },
      status: "succeeded",
      startedAt: createdAt,
      finishedAt: now(),
    },
    {
      id: "tool-rerank",
      tool: "cross_encoder_rerank",
      purpose: "按实验设计与工具参数进行精排",
      input: { candidates: 20, keep: 6 },
      output: { kept: 6, threshold: 0.72 },
      status: "succeeded",
      startedAt: createdAt,
      finishedAt: now(),
    },
    {
      id: "tool-deseq2",
      tool: "run_deseq2_preview",
      purpose: "验证设计矩阵并生成可审批计划",
      input: { designFormula: "~ condition + batch", contrast: "condition_treated_vs_control" },
      output: { status: "ready_for_approval", estimatedSeconds: 150 },
      status: "succeeded",
      startedAt: createdAt,
      finishedAt: now(),
    },
  ];

  return {
    id: `rag_${randomUUID()}`,
    query,
    normalizedQuery,
    status: "completed",
    createdAt,
    completedAt: now(),
    durationMs: Math.max(18, Date.now() - started),
    parsedDocuments: documents,
    chunks,
    retrievalTop20,
    rerankedResults,
    graphRelations,
    groundingBindings,
    toolCalls,
    finalDecision: {
      summary: "已完成文档解析、Top 20 召回、精排和参数 grounding，可生成 RNA-seq 分析计划。",
      nextAction: "请确认四项分析信息并审批计划",
      evidenceChunkIds: rerankedResults.filter((item) => item.kept).map((item) => item.chunkId),
    },
  };
}
