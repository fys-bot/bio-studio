import { NextResponse } from "next/server";
import { isAuthorized, isSameOrigin } from "@/lib/auth";
import { retryNode } from "@/lib/store";
export async function POST(
  request: Request,
  { params }: { params: { runId: string; nodeId: string } },
) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  return NextResponse.json(retryNode(params.runId, params.nodeId));
}
