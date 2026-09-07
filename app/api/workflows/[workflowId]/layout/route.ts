import { NextResponse } from "next/server";
import { isAuthorized, isSameOrigin } from "@/lib/auth";
import {
  createWorkflowLayoutVersion,
  saveWorkflowLayout,
  workflowLayoutSnapshot,
} from "@/lib/store";
import type { WorkflowLayoutInput } from "@/lib/workflow-layout";

type LayoutRequestBody = WorkflowLayoutInput & {
  name?: string;
};

export async function GET(request: Request) {
  if (!isAuthorized()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const taskId = new URL(request.url).searchParams.get("taskId") || undefined;
  return NextResponse.json({ layout: workflowLayoutSnapshot(taskId) });
}

export async function PUT(request: Request) {
  if (!isAuthorized()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const input = (await request.json().catch(() => ({}))) as LayoutRequestBody;
  const taskId = new URL(request.url).searchParams.get("taskId") || undefined;
  return NextResponse.json({ layout: saveWorkflowLayout(input, taskId) });
}

export async function POST(request: Request) {
  if (!isAuthorized()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const input = (await request.json().catch(() => ({}))) as LayoutRequestBody;
  const taskId = new URL(request.url).searchParams.get("taskId") || undefined;
  const result = createWorkflowLayoutVersion(input.name ?? "", input, taskId);
  return NextResponse.json(result);
}
