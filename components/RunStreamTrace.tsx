"use client";

import {
  Activity,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  CircleX,
  LoaderCircle,
} from "lucide-react";

export type RunStreamEvent = {
  id: number;
  runId: string;
  type: string;
  createdAt: string;
  nodeId?: string;
  payload: Record<string, unknown>;
};

type StreamStatus = "connected" | "reconnecting" | "disconnected";

const eventLabels: Record<string, string> = {
  "run.started": "工作流开始",
  "rag.trace.created": "创建 RAG Trace",
  "code.delta": "生成分析代码",
  "code.completed": "分析代码完成",
  "intent.detected": "识别研究意图",
  "retrieval.started": "开始检索证据",
  "retrieval.hit": "检索命中",
  "evidence.reranked": "证据重排",
  "grounding.bound": "绑定参数依据",
  "node.updated": "更新工作流节点",
  "run.completed": "运行完成",
  "run.cancelled": "运行已取消",
};

const nodeLabels: Record<string, string> = {
  input: "输入校验",
  qc: "质量控制",
  design: "实验设计",
  de: "差异表达计算",
  volcano: "结果可视化",
  report: "科研报告",
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function eventSummary(event: RunStreamEvent) {
  const payload = event.payload;
  if (stringValue(payload.message)) return stringValue(payload.message);
  if (event.type === "rag.trace.created") return `已建立 Top ${payload.topK || 0} 检索轨迹`;
  if (event.type === "code.delta") {
    return `已流式生成 ${stringValue(payload.text).length.toLocaleString("zh-CN")} 个字符`;
  }
  if (event.type === "code.completed") return `共生成 ${payload.characterCount || 0} 个字符`;
  if (event.type === "intent.detected") {
    return [payload.domain, payload.comparison].filter(Boolean).join(" · ");
  }
  if (event.type === "retrieval.started" && Array.isArray(payload.sources)) {
    return `检索 ${payload.sources.join("、")}`;
  }
  if (event.type === "retrieval.hit") {
    return `项目文件 ${payload.projectFiles || 0} · 技能 ${payload.skills || 0} · 文献 ${payload.literature || 0}`;
  }
  if (event.type === "evidence.reranked") {
    return `保留 ${payload.kept || 0} 条证据 · 置信度 ${payload.confidence || "-"}`;
  }
  if (event.type === "grounding.bound" && Array.isArray(payload.parameters)) {
    return `已绑定 ${payload.parameters.join("、")}`;
  }
  if (event.type === "node.updated") {
    return (
      stringValue(payload.detail) ||
      stringValue(payload.error) ||
      `状态：${payload.status || "更新"}`
    );
  }
  const preview = Object.entries(payload)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join("、") : String(value)}`)
    .join(" · ");
  return preview || "事件已接收";
}

function eventTone(event: RunStreamEvent, latest: boolean) {
  if (
    event.type.includes("cancelled") ||
    event.type.includes("failed") ||
    event.payload.status === "failed"
  ) {
    return "error";
  }
  if (
    event.type === "run.completed" ||
    event.type === "code.completed" ||
    event.type === "evidence.reranked" ||
    event.type === "grounding.bound" ||
    event.payload.status === "succeeded"
  ) {
    return "success";
  }
  return latest ? "active" : "idle";
}

function ToneIcon({ tone }: { tone: ReturnType<typeof eventTone> }) {
  if (tone === "success") return <CheckCircle2 size={14} />;
  if (tone === "error") return <CircleX size={14} />;
  if (tone === "active") return <LoaderCircle className="is-spinning" size={14} />;
  return <CircleDashed size={14} />;
}

export function RunStreamTrace({
  events,
  open,
  streamStatus,
  onToggle,
}: {
  events: RunStreamEvent[];
  open: boolean;
  streamStatus: StreamStatus;
  onToggle: () => void;
}) {
  const latestEvent = events.at(-1);
  const connectionLabel =
    streamStatus === "connected"
      ? "SSE 已连接"
      : streamStatus === "reconnecting"
        ? "正在重连"
        : "等待连接";

  return (
    <section className={`run-stream-trace ${open ? "is-open" : ""}`} data-guide="evidence">
      <button className="run-trace-summary" type="button" onClick={onToggle} aria-expanded={open}>
        <span className="run-trace-mark">
          <Activity size={15} />
        </span>
        <span className="run-trace-title">
          <b>运行过程</b>
          <small>{events.length ? `${events.length} 个实时步骤` : "尚未启动工作流"}</small>
        </span>
        <span className="run-trace-current">
          <b>{latestEvent ? eventLabels[latestEvent.type] || latestEvent.type : "等待运行事件"}</b>
          <small>
            {latestEvent ? eventSummary(latestEvent) : "运行后将在这里逐步输出处理过程"}
          </small>
        </span>
        <span className={`run-trace-connection ${streamStatus}`}>
          <i /> {connectionLabel}
        </span>
        <ChevronDown className="run-trace-chevron" size={15} />
      </button>

      {open && (
        <div className="run-trace-events" aria-live="polite">
          {events.length === 0 && (
            <div className="run-trace-empty">
              <CircleDashed size={17} />
              <span>完成分析信息并运行工作流后，这里会接收真实 SSE 事件。</span>
            </div>
          )}
          {events.map((event, index) => {
            const tone = eventTone(event, index === events.length - 1);
            return (
              <details className={`run-trace-event ${tone}`} key={`${event.runId}-${event.id}`}>
                <summary>
                  <span className="run-trace-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="run-trace-tone">
                    <ToneIcon tone={tone} />
                  </span>
                  <span className="run-trace-copy">
                    <b>{eventLabels[event.type] || event.type}</b>
                    <small>{eventSummary(event)}</small>
                  </span>
                  <span className="run-trace-meta">
                    {event.nodeId && <b>{nodeLabels[event.nodeId] || event.nodeId}</b>}
                    <time>
                      {new Date(event.createdAt).toLocaleTimeString("zh-CN", { hour12: false })}
                    </time>
                  </span>
                  <ChevronDown size={14} />
                </summary>
                <div className="run-trace-detail">
                  <dl>
                    <div>
                      <dt>事件类型</dt>
                      <dd>{event.type}</dd>
                    </div>
                    <div>
                      <dt>发生时间</dt>
                      <dd>
                        {new Date(event.createdAt).toLocaleString("zh-CN", { hour12: false })}
                      </dd>
                    </div>
                    <div>
                      <dt>节点</dt>
                      <dd>
                        {event.nodeId ? nodeLabels[event.nodeId] || event.nodeId : "全局运行"}
                      </dd>
                    </div>
                  </dl>
                  <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
