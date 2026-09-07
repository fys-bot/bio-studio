import { isAuthorized } from "@/lib/auth";
import { researchResponse } from "@/lib/research-service";

export async function GET(_request: Request, { params }: { params: { fileId: string } }) {
  if (!isAuthorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const response = await researchResponse(
      `/documents/${encodeURIComponent(params.fileId)}/original`,
    );
    return new Response(response.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": response.headers.get("Content-Disposition") || "attachment",
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
