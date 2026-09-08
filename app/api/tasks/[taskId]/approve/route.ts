import { NextResponse } from "next/server";
import { authGuard, isSameOrigin } from "@/lib/auth";
import { approvePlan } from "@/lib/store";

export async function POST(request: Request, { params }: { params: { taskId: string } }) {
  const denied = authGuard("tasks:write");
  if (denied) return denied;
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const task = approvePlan(params.taskId);
  if (!task)
    return NextResponse.json({ error: "Task not found or LLM plan missing" }, { status: 404 });
  return NextResponse.json({ task });
}
