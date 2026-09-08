import { NextResponse } from "next/server";
import { authGuard, isAuthorized, isSameOrigin } from "@/lib/auth";
import { detachFileFromTasks } from "@/lib/store";
import { ResearchServiceError, researchJson, type ResearchDocument } from "@/lib/research-service";

export async function GET(_request: Request, { params }: { params: { fileId: string } }) {
  if (!isAuthorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await researchJson(`/documents/${encodeURIComponent(params.fileId)}`));
  } catch (error) {
    const status = error instanceof ResearchServiceError ? error.status : 503;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "文档无法读取" },
      { status },
    );
  }
}

export async function DELETE(request: Request, { params }: { params: { fileId: string } }) {
  const denied = authGuard("files:write");
  if (denied) return denied;
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }
  const fileId = encodeURIComponent(params.fileId);
  try {
    const document = await researchJson<ResearchDocument>(`/documents/${fileId}`);
    const deleted = await researchJson<{ deletedFileId: string; deletedName: string }>(
      `/documents/${fileId}`,
      { method: "DELETE" },
    );
    const affectedTaskIds = detachFileFromTasks(params.fileId, document.name);
    return NextResponse.json({ ...deleted, affectedTaskIds });
  } catch (error) {
    const status = error instanceof ResearchServiceError ? error.status : 503;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "文档删除失败" },
      { status },
    );
  }
}
