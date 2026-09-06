import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { getRagTrace } from "@/lib/store";

export async function GET(_request: Request, context: { params: { traceId: string } }) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const trace = getRagTrace(context.params.traceId);
  if (!trace) return NextResponse.json({ error: "RAG Trace 不存在" }, { status: 404 });
  return NextResponse.json({ trace });
}
