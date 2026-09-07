import { isAuthorized } from "@/lib/auth";
import { taskSnapshot } from "@/lib/store";
import { researchResponse } from "@/lib/research-service";

export async function GET(
  _request: Request,
  { params }: { params: { taskId: string; name: string } },
) {
  if (!isAuthorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const task = taskSnapshot(params.taskId);
  if (!task?.analysisJobId) return Response.json({ error: "Artifact not found" }, { status: 404 });
  try {
    const response = await researchResponse(
      `/jobs/${task.analysisJobId}/artifacts/${encodeURIComponent(params.name)}`,
    );
    return new Response(response.body, {
      headers: {
        "Content-Type": params.name === "volcano.png" ? "image/png" : "application/octet-stream",
        "Content-Disposition": response.headers.get("Content-Disposition") || "attachment",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "产物不可用" },
      { status: 503 },
    );
  }
}
