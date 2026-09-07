import { NextResponse } from "next/server";
import { isAuthorized, isSameOrigin } from "@/lib/auth";
import { researchJson, ResearchServiceError } from "@/lib/research-service";
import { saveTaskPlan, taskSnapshot } from "@/lib/store";
import { generateLlmPlan } from "@/lib/llm-client";

export async function POST(request: Request) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as {
    taskId?: string;
    query?: string;
    clarification?: Record<string, string>;
    evidence?: unknown[];
  } | null;
  if (!body?.taskId || !body.query)
    return NextResponse.json({ error: "任务和问题不能为空" }, { status: 400 });
  if (!taskSnapshot(body.taskId))
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  try {
    let result: {
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
    const attempts: Array<{ stage: "research-worker" | "direct-llm"; error: string }> = [];
    try {
      result = await researchJson<typeof result>(
        "/agent/plan",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: body.query,
            clarification: body.clarification || {},
            evidence: body.evidence || [],
          }),
        },
        190_000,
      );
    } catch (workerError) {
      attempts.push({
        stage: "research-worker",
        error: workerError instanceof Error ? workerError.message : "科研 Worker 调用失败",
      });
      try {
        if (workerError instanceof ResearchServiceError && workerError.status === 502) {
          throw workerError;
        }
        result = await generateLlmPlan({
          query: body.query,
          clarification: body.clarification || {},
          evidence: body.evidence || [],
        });
      } catch (llmError) {
        attempts.push({
          stage: "direct-llm",
          error: llmError instanceof Error ? llmError.message : "LLM 直连失败",
        });
        const lastError = attempts.at(-1)?.error || "分析计划生成失败";
        return NextResponse.json(
          {
            error: `分析计划生成失败：${lastError}`,
            code: "PLAN_GENERATION_UNAVAILABLE",
            attempts,
            hint: "请检查 LLM_BASE_URL 是否包含 API 版本路径（通常为 /v1），并确认 Key 与该服务匹配。",
          },
          { status: 502 },
        );
      }
    }
    const plan = {
      ...result.plan,
      provider: "llm" as const,
      model: result.model,
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json({ plan, task: saveTaskPlan(body.taskId, plan) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "LLM 计划生成失败",
        code: "PLAN_PERSISTENCE_FAILED",
      },
      { status: 500 },
    );
  }
}
