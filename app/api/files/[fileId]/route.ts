import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { researchJson } from "@/lib/research-service";

export async function GET(_request: Request, { params }: { params: { fileId: string } }) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await researchJson(`/documents/${encodeURIComponent(params.fileId)}`));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "文档无法读取" },
      { status: 503 },
    );
  }
}
