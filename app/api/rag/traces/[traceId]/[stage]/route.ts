import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { getRagTrace } from "@/lib/store";

const stageMap = {
  documents: "parsedDocuments",
  chunks: "chunks",
  retrieval: "retrievalTop20",
  rerank: "rerankedResults",
  graph: "graphRelations",
  grounding: "groundingBindings",
  tools: "toolCalls",
} as const;

export async function GET(
  _request: Request,
  context: { params: { traceId: string; stage: string } },
) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const trace = getRagTrace(context.params.traceId);
  if (!trace) return NextResponse.json({ error: "RAG Trace 不存在" }, { status: 404 });
  const field = stageMap[context.params.stage as keyof typeof stageMap];
  if (!field) return NextResponse.json({ error: "未知的 RAG 阶段" }, { status: 404 });
  return NextResponse.json({ traceId: trace.id, stage: context.params.stage, data: trace[field] });
}
