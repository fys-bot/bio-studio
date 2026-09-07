import { NextResponse } from "next/server";
import { isAuthorized, isSameOrigin } from "@/lib/auth";
import { conversationSnapshot, saveConversation } from "@/lib/store";
import type { ConversationMessage } from "@/lib/domain";

export async function GET(_request: Request, { params }: { params: { taskId: string } }) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ messages: conversationSnapshot(params.taskId) });
}

export async function PUT(request: Request, { params }: { params: { taskId: string } }) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { messages?: ConversationMessage[] };
  if (!Array.isArray(body.messages) || body.messages.length > 100) {
    return NextResponse.json({ error: "消息格式不正确" }, { status: 400 });
  }
  const messages = saveConversation(params.taskId, body.messages);
  if (!messages) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ messages });
}
