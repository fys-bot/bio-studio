import { NextResponse } from "next/server";
import { authGuard, isAuthorized, isSameOrigin } from "@/lib/auth";
import type { RagTrace } from "@/lib/domain";
import { generateLlmAnswer } from "@/lib/llm-client";
import { createAndStoreRagTrace, listRagTraces, saveRagTrace, taskSnapshot } from "@/lib/store";
import { queryRealDocuments } from "@/lib/real-rag";
import { normalizeAgentMode, reasoningEffortForMode } from "@/lib/agent-mode";

function answerEvidence(trace: RagTrace) {
  const chunksById = new Map(trace.chunks.map((chunk) => [chunk.id, chunk]));
  const documentsById = new Map(trace.parsedDocuments.map((document) => [document.id, document]));
  const ranked = trace.rerankedResults.filter((result) => result.kept);
  const sources = (ranked.length ? ranked : trace.retrievalTop20).slice(0, 3);
  return sources.map((result, index) => {
    const chunk = chunksById.get(result.chunkId);
    const document = documentsById.get(result.documentId);
    const location = [chunk?.metadata.page, chunk?.metadata.sheet, chunk?.metadata.section]
      .filter(Boolean)
      .join(" · ");
    return {
      label: `[${index + 1}]`,
      source: document?.name || result.documentId,
      location,
      text: chunk?.text || result.reason,
    };
  });
}

export async function GET() {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ traces: listRagTraces() });
}

export async function POST(request: Request) {
  const denied = authGuard("runs:execute");
  if (denied) return denied;
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const payload = (await request.json().catch(() => ({}))) as {
    query?: unknown;
    mode?: unknown;
    includeAnswer?: unknown;
  };
  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  if (!query || query.length > 2000) {
    return NextResponse.json({ error: "问题不能为空且不能超过 2000 个字符" }, { status: 400 });
  }
  const taskId = new URL(request.url).searchParams.get("taskId") || undefined;
  const task = taskSnapshot(taskId || "task_demo_rnaseq");
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const agentMode = normalizeAgentMode(payload.mode);
  const reasoningEffort = reasoningEffortForMode(agentMode);
  let trace: RagTrace;
  try {
    if (task.fileIds?.length) {
      trace = saveRagTrace({
        ...(await queryRealDocuments(query, task.fileIds)),
        agentMode,
        reasoningEffort,
      });
    } else {
      if (task.executionMode === "real")
        return NextResponse.json({ error: "请先上传或绑定项目文件" }, { status: 409 });
      trace = createAndStoreRagTrace(query, taskId, { agentMode, reasoningEffort });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "检索失败" },
      { status: 422 },
    );
  }

  if (payload.includeAnswer !== true) return NextResponse.json({ trace });

  try {
    const answer = await generateLlmAnswer({
      query,
      taskGoal: task.goal,
      mode: agentMode,
      evidence: answerEvidence(trace),
    });
    return NextResponse.json({ trace, answer });
  } catch (error) {
    return NextResponse.json(
      {
        error: `大模型分析答复失败：${error instanceof Error ? error.message : "未知错误"}`,
        traceId: trace.id,
      },
      { status: 502 },
    );
  }
}
