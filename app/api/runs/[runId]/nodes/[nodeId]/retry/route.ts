import { NextResponse } from "next/server";
import { authGuard, isSameOrigin } from "@/lib/auth";
import { retryNode } from "@/lib/store";
export async function POST(
  request: Request,
  { params }: { params: { runId: string; nodeId: string } },
) {
  const denied = authGuard("runs:execute");
  if (denied) return denied;
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  return NextResponse.json(retryNode(params.runId, params.nodeId));
}
