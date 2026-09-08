import { NextResponse } from "next/server";
import { authGuard, isSameOrigin } from "@/lib/auth";
import { generateLlmPlan } from "@/lib/llm-client";
import { researchJson, ResearchServiceError } from "@/lib/research-service";
import { saveTaskPlan, taskSnapshot } from "@/lib/store";
import { normalizeAgentMode, reasoningEffortForMode, type AgentMode } from "@/lib/agent-mode";

type PlanRequest = {
  taskId: string;
  query: string;
  clarification: Record<string, string>;
  evidence: unknown[];
  mode: AgentMode;
};

type ProviderResult = {
  provider: "openai-compatible";
  model: string;
  plan: {
    title: string;
    summary: string;
    steps: Array<{ id: string; title: string; detail: string }>;
    risks: string[];
    requiredInputs: string[];
  };
};

type PlanAttempt = { stage: "research-worker" | "direct-llm"; error: string };
type PlanEventEmitter = (type: string, payload: Record<string, unknown>) => void;

class PlanGenerationError extends Error {
  readonly attempts: PlanAttempt[];

  constructor(message: string, attempts: PlanAttempt[]) {
    super(message);
    this.name = "PlanGenerationError";
    this.attempts = attempts;
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function generateAndPersistPlan(body: PlanRequest, emit: PlanEventEmitter) {
  const reasoningEffort = reasoningEffortForMode(body.mode);
  emit("plan.started", {
    stage: "validation",
    step: 1,
    totalSteps: 5,
    progress: 8,
    detail: "已校验任务、研究问题、澄清信息与证据输入",
    mode: body.mode,
    reasoningEffort,
  });

  let result: ProviderResult;
  const attempts: PlanAttempt[] = [];
  try {
    emit("worker.started", {
      stage: "research-worker",
      step: 2,
      totalSteps: 5,
      progress: 24,
      detail: "正在调用本地科研 Worker，由 Worker 请求已配置的大模型生成结构化计划",
      waitingFor: "科研 Worker 返回 title、steps、risks 与 requiredInputs",
    });
    result = await researchJson<ProviderResult>(
      "/agent/plan",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: body.query,
          clarification: body.clarification,
          evidence: body.evidence,
          mode: body.mode,
        }),
      },
      190_000,
    );
    emit("worker.completed", {
      stage: "research-worker",
      step: 3,
      totalSteps: 5,
      progress: 72,
      detail: `科研 Worker 已返回 ${result.plan.steps.length} 个可执行步骤`,
      model: result.model,
      mode: body.mode,
      reasoningEffort,
    });
  } catch (workerError) {
    const workerFailure = errorMessage(workerError, "科研 Worker 调用失败");
    attempts.push({ stage: "research-worker", error: workerFailure });
    emit("worker.failed", {
      stage: "research-worker",
      step: 2,
      totalSteps: 5,
      progress: 30,
      detail: workerFailure,
      fallback: !(workerError instanceof ResearchServiceError && workerError.status === 502),
    });

    if (workerError instanceof ResearchServiceError && workerError.status === 502) {
      throw new PlanGenerationError(workerFailure, attempts);
    }
    try {
      emit("llm.started", {
        stage: "direct-llm",
        step: 3,
        totalSteps: 5,
        progress: 44,
        detail: "科研 Worker 不可用，正在通过 Next.js 适配器直连同一大模型配置",
        waitingFor: "大模型返回符合生命科学计划 Schema 的 JSON",
      });
      result = await generateLlmPlan({
        query: body.query,
        clarification: body.clarification,
        evidence: body.evidence,
        mode: body.mode,
      });
      emit("llm.completed", {
        stage: "direct-llm",
        step: 3,
        totalSteps: 5,
        progress: 72,
        detail: `大模型已返回 ${result.plan.steps.length} 个可执行步骤`,
        model: result.model,
        mode: body.mode,
        reasoningEffort,
      });
    } catch (llmError) {
      const llmFailure = errorMessage(llmError, "LLM 直连失败");
      attempts.push({ stage: "direct-llm", error: llmFailure });
      throw new PlanGenerationError(llmFailure, attempts);
    }
  }

  emit("plan.persisting", {
    stage: "persistence",
    step: 4,
    totalSteps: 5,
    progress: 88,
    detail: "正在校验计划结构并写入当前任务快照",
  });
  const plan = {
    ...result.plan,
    provider: "llm" as const,
    model: result.model,
    mode: body.mode,
    reasoningEffort,
    generatedAt: new Date().toISOString(),
  };
  const task = saveTaskPlan(body.taskId, plan);
  if (!task) throw new Error("计划已生成，但任务快照写入失败");
  return { plan, task };
}

function planFailurePayload(error: unknown) {
  const attempts = error instanceof PlanGenerationError ? error.attempts : [];
  const lastError = errorMessage(error, "分析计划生成失败");
  return {
    error: `分析计划生成失败：${lastError}`,
    code:
      error instanceof PlanGenerationError
        ? "PLAN_GENERATION_UNAVAILABLE"
        : "PLAN_PERSISTENCE_FAILED",
    attempts,
    hint: "请检查 LLM_BASE_URL 是否包含 API 版本路径（通常为 /v1），并确认 Key 与该服务匹配。",
  };
}

function streamPlan(request: Request, body: PlanRequest) {
  const encoder = new TextEncoder();
  let eventId = 0;
  let activeStage = "validation";
  let activeProgress = 8;
  let waitingFor = "计划生成服务开始处理";
  const startedAt = Date.now();
  let waitingTimer: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (
        type: string,
        payload: Record<string, unknown>,
        extra: Record<string, unknown> = {},
      ) => {
        if (closed) return;
        if (typeof payload.stage === "string") activeStage = payload.stage;
        if (typeof payload.progress === "number") activeProgress = payload.progress;
        if (typeof payload.waitingFor === "string") waitingFor = payload.waitingFor;
        eventId += 1;
        const event = {
          id: eventId,
          runId: `planning:${body.taskId}`,
          type,
          createdAt: new Date().toISOString(),
          payload,
        };
        controller.enqueue(
          encoder.encode(
            `id: ${eventId}\nevent: ${type}\ndata: ${JSON.stringify({ event, ...extra })}\n\n`,
          ),
        );
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (waitingTimer) clearInterval(waitingTimer);
        controller.close();
      };

      waitingTimer = setInterval(() => {
        send("plan.waiting", {
          stage: activeStage,
          progress: activeProgress,
          elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
          detail: waitingFor,
        });
      }, 8_000);

      request.signal.addEventListener("abort", close, { once: true });
      void generateAndPersistPlan(body, (type, payload) => send(type, payload))
        .then((result) =>
          send(
            "plan.completed",
            {
              stage: "completed",
              step: 5,
              totalSteps: 5,
              progress: 100,
              detail: `分析计划已就绪，共 ${result.plan.steps.length} 个步骤，可进入人工审批`,
              model: result.plan.model,
              mode: result.plan.mode,
              reasoningEffort: result.plan.reasoningEffort,
            },
            { result },
          ),
        )
        .catch((error) => {
          const failure = planFailurePayload(error);
          send(
            "plan.failed",
            {
              stage: "failed",
              progress: activeProgress,
              detail: failure.error,
              attempts: failure.attempts,
              hint: failure.hint,
            },
            failure,
          );
        })
        .finally(close);
    },
    cancel() {
      closed = true;
      if (waitingTimer) clearInterval(waitingTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request) {
  const denied = authGuard("runs:execute");
  if (denied) return denied;
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const input = (await request.json().catch(() => null)) as Partial<PlanRequest> | null;
  if (!input?.taskId || !input.query)
    return NextResponse.json({ error: "任务和问题不能为空" }, { status: 400 });
  if (!taskSnapshot(input.taskId))
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const body: PlanRequest = {
    taskId: input.taskId,
    query: input.query,
    clarification: input.clarification || {},
    evidence: input.evidence || [],
    mode: normalizeAgentMode(input.mode),
  };

  if (request.headers.get("accept")?.includes("text/event-stream")) {
    return streamPlan(request, body);
  }

  try {
    return NextResponse.json(await generateAndPersistPlan(body, () => undefined));
  } catch (error) {
    const failure = planFailurePayload(error);
    return NextResponse.json(failure, {
      status: failure.code === "PLAN_GENERATION_UNAVAILABLE" ? 502 : 500,
    });
  }
}
