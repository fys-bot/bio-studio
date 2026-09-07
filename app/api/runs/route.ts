import { NextResponse } from "next/server";
import { isAuthorized, isSameOrigin } from "@/lib/auth";
import { createRun, taskSnapshot } from "@/lib/store";

export async function POST(request: Request) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const taskId = new URL(request.url).searchParams.get("taskId") || undefined;
  if (taskSnapshot(taskId || "task_demo_rnaseq")?.executionMode === "real")
    return NextResponse.json({ error: "真实任务请使用已批准的输入与计算面板" }, { status: 409 });
  const result = createRun(taskId);
  if (result.status === "not_found")
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json(result);
}
