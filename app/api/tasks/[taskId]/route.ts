import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { listTaskCards, taskSnapshot } from "@/lib/store";

export async function GET(_request: Request, { params }: { params: { taskId: string } }) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const task = taskSnapshot(params.taskId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ task, tasks: listTaskCards() });
}
