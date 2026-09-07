import { NextResponse } from "next/server";
import { isAuthorized, isSameOrigin } from "@/lib/auth";
import { deleteTaskRecord, listTaskCards, taskSnapshot } from "@/lib/store";

export async function GET(_request: Request, { params }: { params: { taskId: string } }) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const task = taskSnapshot(params.taskId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ task, tasks: listTaskCards() });
}

export async function DELETE(request: Request, { params }: { params: { taskId: string } }) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const result = deleteTaskRecord(params.taskId);
  if (!result.deleted)
    return NextResponse.json(
      { error: result.reason },
      { status: result.reason === "任务不存在" ? 404 : 409 },
    );
  return NextResponse.json({ deletedTaskId: params.taskId, tasks: listTaskCards() });
}
