import { NextResponse } from "next/server";
import { authGuard, isAuthorized, isSameOrigin } from "@/lib/auth";
import type { RagTrace } from "@/lib/domain";
import { generateLlmAnswer } from "@/lib/llm-client";
import {
  conversationSnapshot,
  createAndStoreRagTrace,
  listRagTraces,
  saveRagTrace,
  taskSnapshot,
} from "@/lib/store";
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

function taskConversationContext(messages: unknown, taskId: string) {
  const supplied = Array.isArray(messages)
    ? messages
        .filter(
          (message): message is { role: "user" | "assistant"; content: string; status?: string } =>
            Boolean(
              message &&
                typeof message === "object" &&
                (message.role === "user" || message.role === "assistant") &&
                typeof message.content === "string" &&
                message.content.trim(),
            ),
        )
        .filter((message) => message.status !== "failed" && message.status !== "cancelled")
    : conversationSnapshot(taskId) ?? [];
  return supplied
    .filter((message) => message.status === "completed")
    .slice(-8)
    .map(
      (message) =>
        `${message.role === "user" ? "研究员" : "智能体"}：${message.content.trim().slice(0, 1_500)}`,
    )
    .join("\n")
    .slice(-3_600);
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
    conversation?: unknown;
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
      if (payload.includeAnswer === true) {
        return NextResponse.json(
          {
            error:
              "请先绑定至少一份已索引项目文件。为避免把静态演示 Trace 包装成真实模型对话，当前不会对无材料任务请求 LLM。",
          },
          { status: 409 },
        );
      }
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
      taskContext: [
        `任务名称：${task.title}`,
        `执行状态：${task.status}`,
        `澄清条件：${Object.entries(task.clarification?.answers ?? {})
          .filter(([, value]) => Boolean(value))
          .map(([key, value]) => `${key}=${value}`)
          .join("；") || "未完整填写"}`,
        task.plan?.summary ? `已审批/生成计划摘要：${task.plan.summary}` : "",
        taskConversationContext(payload.conversation, task.id)
          ? `最近对话：\n${taskConversationContext(payload.conversation, task.id)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
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
