import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { getRagTrace } from "@/lib/store";

export async function GET(_request: Request, context: { params: { traceId: string } }) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const trace = getRagTrace(context.params.traceId);
  if (!trace) return NextResponse.json({ error: "RAG Trace 不存在" }, { status: 404 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: trace\ndata: ${JSON.stringify(trace)}\n\n`));
      controller.enqueue(
        encoder.encode(`event: completed\ndata: ${JSON.stringify({ traceId: trace.id })}\n\n`),
      );
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
