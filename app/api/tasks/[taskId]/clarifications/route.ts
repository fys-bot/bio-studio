import { NextResponse } from "next/server";
import { isAuthorized, isSameOrigin } from "@/lib/auth";
import { submitClarifications } from "@/lib/store";
export async function POST(request: Request, { params }: { params: { taskId: string } }) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body?.answers || Object.values(body.answers).some((answer) => !answer))
    return NextResponse.json({ error: "请完成全部澄清项" }, { status: 400 });
  const task = submitClarifications(params.taskId, body.answers);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ task });
}
