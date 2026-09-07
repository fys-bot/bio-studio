import { isAuthorized } from "@/lib/auth";
import { researchResponse } from "@/lib/research-service";
export async function GET() {
  if (!isAuthorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const response = await researchResponse("/openapi.json");
    return new Response(response.body, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=research-openapi.json",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "文档不可用" },
      { status: 503 },
    );
  }
}
