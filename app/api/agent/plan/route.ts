import { NextResponse } from "next/server";
import { isAuthorized, isSameOrigin } from "@/lib/auth";
import { researchJson } from "@/lib/research-service";
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
        120_000,
      );
    } catch {
      result = await generateLlmPlan({
        query: body.query,
        clarification: body.clarification || {},
        evidence: body.evidence || [],
      });
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
      { error: error instanceof Error ? error.message : "LLM 计划生成失败" },
      { status: 503 },
    );
  }
}
