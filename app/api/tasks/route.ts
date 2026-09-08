import { NextResponse } from "next/server";
import { authGuard, isAuthorized, isSameOrigin } from "@/lib/auth";
import { getSkill } from "@/lib/catalog-service";
import { researchJson, type ResearchDocument } from "@/lib/research-service";
import {
  createTaskRecord,
  listTaskCards,
  resetDemoState,
  snapshot,
  taskSnapshot,
} from "@/lib/store";

export async function GET() {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ task: snapshot(), tasks: listTaskCards() });
}

export async function POST(request: Request) {
  const denied = authGuard("tasks:write");
  if (denied) return denied;
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  let body: {
    title?: string;
    skillId?: string;
    fileIds?: string[];
    executionMode?: "real" | "demo";
  } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (typeof body.title === "string" && body.title.trim()) {
    const skill = body.skillId ? getSkill(body.skillId) : undefined;
    if (body.skillId && (!skill || !skill.enabled))
      return NextResponse.json({ error: "技能不存在或未启用" }, { status: 400 });
    if (
      body.fileIds &&
      (!Array.isArray(body.fileIds) ||
        body.fileIds.length > 100 ||
        body.fileIds.some((id) => typeof id !== "string" || !/^[a-f0-9]{32}$/.test(id)))
    )
      return NextResponse.json({ error: "文件标识无效" }, { status: 400 });
    try {
      for (const id of body.fileIds ?? []) await researchJson<ResearchDocument>(`/documents/${id}`);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "文件不存在" },
        { status: 400 },
      );
    }
    const createdTask = createTaskRecord(body.title, {
      skill,
      fileIds: body.fileIds ?? [],
      executionMode: body.executionMode === "demo" ? "demo" : "real",
    });
    return NextResponse.json({
      task: taskSnapshot(createdTask.id) ?? snapshot(),
      tasks: listTaskCards(),
    });
  }
  if (process.env.NODE_ENV === "production")
    return NextResponse.json({ error: "Disabled in production" }, { status: 404 });
  resetDemoState();
  return NextResponse.json({ task: snapshot(), tasks: listTaskCards() });
}
