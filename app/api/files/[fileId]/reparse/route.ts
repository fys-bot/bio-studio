import { NextResponse } from "next/server";
import { authGuard, isSameOrigin } from "@/lib/auth";
import { documentToFile, researchJson, type ResearchDocument } from "@/lib/research-service";

export async function POST(request: Request, { params }: { params: { fileId: string } }) {
  const denied = authGuard("files:write");
  if (denied) return denied;
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  try {
    const document = await researchJson<ResearchDocument>(
      `/documents/${encodeURIComponent(params.fileId)}/reparse`,
      { method: "POST" },
      120_000,
    );
    return NextResponse.json({ file: documentToFile(document) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "解析失败" },
      { status: 503 },
    );
  }
}
