import { NextResponse } from "next/server";
import { authGuard, isAuthorized, isSameOrigin } from "@/lib/auth";
import { createAndStoreRagTrace, listRagTraces, saveRagTrace, taskSnapshot } from "@/lib/store";
import { queryRealDocuments } from "@/lib/real-rag";

export async function GET() {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ traces: listRagTraces() });
}

export async function POST(request: Request) {
  const denied = authGuard("runs:execute");
  if (denied) return denied;
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const payload = (await request.json().catch(() => ({}))) as { query?: unknown };
  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  if (!query || query.length > 2000) {
    return NextResponse.json({ error: "问题不能为空且不能超过 2000 个字符" }, { status: 400 });
  }
  const taskId = new URL(request.url).searchParams.get("taskId") || undefined;
  const task = taskSnapshot(taskId || "task_demo_rnaseq");
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  try {
    if (task.fileIds?.length)
      return NextResponse.json({
        trace: saveRagTrace(await queryRealDocuments(query, task.fileIds)),
      });
    if (task.executionMode === "real")
      return NextResponse.json({ error: "请先上传或绑定项目文件" }, { status: 409 });
    return NextResponse.json({ trace: createAndStoreRagTrace(query, taskId) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "检索失败" },
      { status: 422 },
    );
  }
}
