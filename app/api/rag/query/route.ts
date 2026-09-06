import { NextResponse } from "next/server";
import { isAuthorized, isSameOrigin } from "@/lib/auth";
import { createAndStoreRagTrace, listRagTraces } from "@/lib/store";

export async function GET() {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ traces: listRagTraces() });
}

export async function POST(request: Request) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const payload = (await request.json().catch(() => ({}))) as { query?: unknown };
  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  if (!query || query.length > 2000) {
    return NextResponse.json({ error: "问题不能为空且不能超过 2000 个字符" }, { status: 400 });
  }
  const trace = createAndStoreRagTrace(query);
  return NextResponse.json({ trace });
}
