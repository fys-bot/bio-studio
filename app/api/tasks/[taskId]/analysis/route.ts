import { isAuthorized, isSameOrigin } from "@/lib/auth";
import { attachTaskFiles, bindAnalysisJob, syncAnalysisJob, taskSnapshot } from "@/lib/store";
import { researchJson, type AnalysisJob, type ResearchDocument } from "@/lib/research-service";

function streamAnalysisJob(request: Request, taskId: string, jobId: string) {
  const encoder = new TextEncoder();
  let eventId = 0;
  let closed = false;
  let previousStatus = "";
  let heartbeatAt = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (type: string, payload: Record<string, unknown>) => {
        if (closed) return;
        eventId += 1;
        controller.enqueue(
          encoder.encode(
            `id: ${eventId}\nevent: ${type}\ndata: ${JSON.stringify({
              id: eventId,
              runId: jobId,
              type,
              createdAt: new Date().toISOString(),
              payload,
            })}\n\n`,
          ),
        );
      };
      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };
      const statusEvent = (job: AnalysisJob) => {
        const elapsedSeconds = Math.max(0, Math.round(Date.now() / 1000 - job.createdAt));
        if (job.status === "queued") {
          return [
            "analysis.queued",
            {
              stage: "compute-queue",
              progress: 10,
              elapsedSeconds,
              detail: "作业已写入 SQLite 队列，等待独立计算 Worker 获取任务",
            },
          ] as const;
        }
        if (job.status === "running") {
          return [
            "analysis.running",
            {
              stage: "pydeseq2",
              progress: 52,
              elapsedSeconds,
              detail: "独立子进程正在校验输入、拟合负二项模型并计算多重检验校正",
            },
          ] as const;
        }
        if (job.status === "succeeded") {
          return [
            "analysis.completed",
            {
              stage: "artifacts",
              progress: 100,
              elapsedSeconds,
              detail: `真实计算完成，已生成 ${job.result?.artifacts.length || 0} 个结果产物`,
              summary: job.result?.summary,
            },
          ] as const;
        }
        if (job.status === "failed") {
          return [
            "analysis.failed",
            {
              stage: "failed",
              progress: 52,
              elapsedSeconds,
              detail: job.error || "PyDESeq2 作业执行失败",
            },
          ] as const;
        }
        return [
          "analysis.cancelled",
          {
            stage: "cancelled",
            progress: 0,
            elapsedSeconds,
            detail: "计算作业已取消，已停止等待后续产物",
          },
        ] as const;
      };
      const run = async () => {
        send("analysis.stream.connected", {
          stage: "event-stream",
          progress: 4,
          detail: "SSE 已连接，服务端正在跟踪真实计算 Worker 状态",
          taskId,
        });
        try {
          while (!closed && !request.signal.aborted) {
            const job = await researchJson<AnalysisJob>(`/jobs/${jobId}`);
            const [type, payload] = statusEvent(job);
            if (job.status !== previousStatus) {
              previousStatus = job.status;
              heartbeatAt = Date.now();
              send(type, payload);
            } else if (
              ["queued", "running"].includes(job.status) &&
              Date.now() - heartbeatAt >= 4_000
            ) {
              heartbeatAt = Date.now();
              send("analysis.waiting", {
                ...payload,
                detail:
                  job.status === "queued"
                    ? "队列仍在等待 Worker；页面可以离开，作业状态会持续保存"
                    : "PyDESeq2 仍在计算，正在等待统计结果和火山图产物写入",
              });
            }
            if (["succeeded", "failed", "cancelled"].includes(job.status)) {
              close();
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 700));
          }
        } catch (error) {
          send("analysis.failed", {
            stage: "event-stream",
            progress: 0,
            detail: error instanceof Error ? error.message : "真实计算事件流中断",
          });
          close();
        }
      };

      request.signal.addEventListener("abort", close, { once: true });
      void run();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET(request: Request, { params }: { params: { taskId: string } }) {
  if (!isAuthorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const task = taskSnapshot(params.taskId);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
  const url = new URL(request.url);
  const wantsStream =
    url.searchParams.get("stream") === "1" ||
    request.headers.get("accept")?.includes("text/event-stream");
  if (wantsStream) {
    const jobId = url.searchParams.get("jobId") || task.analysisJobId;
    if (!jobId || jobId !== task.analysisJobId)
      return Response.json({ error: "当前任务没有可订阅的计算作业" }, { status: 409 });
    return streamAnalysisJob(request, task.id, jobId);
  }
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
