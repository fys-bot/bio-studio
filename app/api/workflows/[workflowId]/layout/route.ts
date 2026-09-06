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

export async function GET() {
  if (!isAuthorized()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ layout: workflowLayoutSnapshot() });
}

export async function PUT(request: Request) {
  if (!isAuthorized()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const input = (await request.json().catch(() => ({}))) as LayoutRequestBody;
  return NextResponse.json({ layout: saveWorkflowLayout(input) });
}

export async function POST(request: Request) {
  if (!isAuthorized()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const input = (await request.json().catch(() => ({}))) as LayoutRequestBody;
  const result = createWorkflowLayoutVersion(input.name ?? "", input);
  return NextResponse.json(result);
}
