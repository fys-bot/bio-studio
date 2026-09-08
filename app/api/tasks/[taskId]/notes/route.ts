import { NextResponse } from "next/server";
import { authGuard, isAuthorized, isSameOrigin } from "@/lib/auth";
import { notesSnapshot, saveNotes } from "@/lib/store";

export async function GET(_request: Request, { params }: { params: { taskId: string } }) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const notes = notesSnapshot(params.taskId);
  if (notes === undefined) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ notes });
}

export async function PUT(request: Request, { params }: { params: { taskId: string } }) {
  const denied = authGuard("reviews:write");
  if (denied) return denied;
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { notes?: unknown };
  if (typeof body.notes !== "string")
    return NextResponse.json({ error: "笔记格式不正确" }, { status: 400 });
  const notes = saveNotes(params.taskId, body.notes);
  if (notes === undefined) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ notes });
}
