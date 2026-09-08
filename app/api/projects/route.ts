import { NextResponse } from "next/server";
import { authGuard, isAuthorized, isSameOrigin } from "@/lib/auth";
import { createProject, deleteProject, listProjects } from "@/lib/project-store";

export async function GET() {
  if (!isAuthorized("tasks:read")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ projects: listProjects() });
}

export async function POST(request: Request) {
  const denied = authGuard("tasks:write");
  if (denied) return denied;
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }
  const input = (await request.json().catch(() => null)) as { name?: unknown } | null;
  if (typeof input?.name !== "string") {
    return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 });
  }
  try {
    const project = createProject(input.name);
    return NextResponse.json({ project, projects: listProjects() }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "项目创建失败" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const denied = authGuard("tasks:write");
  if (denied) return denied;
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少项目标识" }, { status: 400 });
  try {
    const project = deleteProject(id);
    return NextResponse.json({ project, projects: listProjects() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "项目删除失败" },
      { status: 409 },
    );
  }
}
