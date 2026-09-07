import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { documentToFile, researchJson, type ResearchDocument } from "@/lib/research-service";

export async function GET() {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const response = await researchJson<{ documents: ResearchDocument[] }>("/documents");
    const items = response.documents.map(documentToFile);
    return NextResponse.json({
      items,
      total: items.length,
      page: 1,
      pageSize: items.length,
      source: "server-snapshot",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "文件服务不可用" },
      { status: 503 },
    );
  }
}
