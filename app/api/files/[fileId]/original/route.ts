import { isAuthorized } from "@/lib/auth";
import { researchJson, researchResponse, type ResearchDocument } from "@/lib/research-service";

const contentTypes: Record<string, string> = {
  csv: "text/csv; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  md: "text/markdown; charset=utf-8",
  pdf: "application/pdf",
  png: "image/png",
  tsv: "text/tab-separated-values; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(request: Request, { params }: { params: { fileId: string } }) {
  if (!isAuthorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [response, document] = await Promise.all([
      researchResponse(`/documents/${encodeURIComponent(params.fileId)}/original`),
      researchJson<ResearchDocument>(`/documents/${encodeURIComponent(params.fileId)}`),
    ]);
    const format = document.format.toLowerCase();
    const download = new URL(request.url).searchParams.has("download");
    const encodedName = encodeURIComponent(document.name);
    return new Response(response.body, {
      headers: {
        "Content-Type": contentTypes[format] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "无法下载" },
      { status: 503 },
    );
  }
}
