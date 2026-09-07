import { isAuthorized, isSameOrigin } from "@/lib/auth";
import { attachTaskFiles, bindAnalysisJob, syncAnalysisJob, taskSnapshot } from "@/lib/store";
import { researchJson, type AnalysisJob, type ResearchDocument } from "@/lib/research-service";

export async function GET(_request: Request, { params }: { params: { taskId: string } }) {
  if (!isAuthorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const task = taskSnapshot(params.taskId);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
  if (!task.analysisJobId) return Response.json({ job: null, task });
  try {
    const job = await researchJson<AnalysisJob>(`/jobs/${task.analysisJobId}`);
    return Response.json({ job, task: syncAnalysisJob(task.id, job.status) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "运行状态不可用" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request, { params }: { params: { taskId: string } }) {
  if (!isAuthorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) return Response.json({ error: "Forbidden origin" }, { status: 403 });
  const task = taskSnapshot(params.taskId);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "无效请求" }, { status: 400 });
  try {
    if (body.action === "samples") {
      const result = await researchJson<{ documents: ResearchDocument[] }>("/samples");
      for (const document of result.documents) {
        if (["pending", "failed"].includes(document.indexStatus))
          await researchJson(`/documents/${document.id}/reparse`, { method: "POST" });
      }
      return Response.json({
        task: attachTaskFiles(
          task.id,
          result.documents.map((doc) => doc.id),
        ),
      });
    }
    if (body.action === "cancel") {
      if (!task.analysisJobId) return Response.json({ error: "没有运行中的作业" }, { status: 409 });
      const job = await researchJson<AnalysisJob>(`/jobs/${task.analysisJobId}/cancel`, {
        method: "POST",
      });
      return Response.json({ job, task: syncAnalysisJob(task.id, job.status) });
    }
    if (!["queued", "failed", "cancelled", "succeeded", "running"].includes(task.status))
      return Response.json({ error: "请先完成澄清并批准计划" }, { status: 409 });
    if (task.skill && task.skill.id !== "rnaseq-deseq2")
      return Response.json(
        { error: "当前已实现的真实计算器是 PyDESeq2；此技能可检索文档，但尚无对应计算器" },
        { status: 409 },
      );
    if (!task.fileIds?.includes(body.countsId) || !task.fileIds.includes(body.metadataId))
      return Response.json({ error: "输入文件未绑定到当前任务" }, { status: 400 });
    const payload = {
      taskId: task.id,
      countsId: body.countsId,
      metadataId: body.metadataId,
      condition: body.condition || "condition",
      control: body.control,
      treated: body.treated,
      batch: body.batch || null,
      alpha: body.alpha ?? 0.05,
    };
    const job = await researchJson<AnalysisJob>("/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return Response.json({ job, task: bindAnalysisJob(task.id, job.id) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "计算服务不可用" },
      { status: 422 },
    );
  }
}
