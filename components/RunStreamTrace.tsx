"use client";

import AccountTreeRounded from "@mui/icons-material/AccountTreeRounded";
import AutorenewRounded from "@mui/icons-material/AutorenewRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ErrorRounded from "@mui/icons-material/ErrorRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import FormatListBulletedRounded from "@mui/icons-material/FormatListBulletedRounded";
import MonitorHeartRounded from "@mui/icons-material/MonitorHeartRounded";
import PendingRounded from "@mui/icons-material/PendingRounded";
import { LinearProgress, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import type { ApiStreamEvent } from "@/lib/api-client";

export type RunStreamEvent = ApiStreamEvent;
type TraceViewMode = "timeline" | "canvas";

export type StreamStatus =
  | "idle"
  | "blocked"
  | "starting"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "completed"
  | "failed";

const eventLabels: Record<string, string> = {
  "client.run.requested": "准备运行上下文",
  "client.run.blocked": "等待补充运行条件",
  "client.approval.required": "等待批准分析计划",
  "client.run.created": "创建运行实例",
  "client.sse.connecting": "建立鉴权事件通道",
  "plan.started": "校验研究上下文",
  "worker.started": "调用科研编排服务",
  "worker.completed": "科研编排服务已响应",
  "worker.failed": "科研编排服务不可用",
  "llm.started": "切换大模型直连",
  "llm.completed": "大模型计划已返回",
  "plan.waiting": "等待上游响应",
  "plan.persisting": "保存分析计划",
  "plan.completed": "分析计划已生成",
  "plan.failed": "分析计划生成失败",
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
  "analysis.stream.connected": "连接真实计算事件流",
  "analysis.queued": "PyDESeq2 已进入队列",
  "analysis.running": "PyDESeq2 正在计算",
  "analysis.waiting": "等待真实计算完成",
  "analysis.completed": "真实计算已完成",
  "analysis.failed": "真实计算失败",
  "analysis.cancelled": "真实计算已取消",
};

const nodeLabels: Record<string, string> = {
  input: "输入校验",
  qc: "质量控制",
  design: "实验设计",
  de: "差异表达计算",
  volcano: "结果可视化",
  report: "科研报告",
};

const statusLabels: Record<StreamStatus, string> = {
  idle: "等待启动",
  blocked: "等待输入",
  starting: "准备运行",
  connecting: "连接事件流",
  connected: "SSE 已连接",
  reconnecting: "正在重连",
  completed: "流程已完成",
  failed: "流程需处理",
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function eventSummary(event: RunStreamEvent) {
  const payload = event.payload;
  if (stringValue(payload.detail)) return stringValue(payload.detail);
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
    .filter(([key]) => !["progress", "stage", "step", "totalSteps"].includes(key))
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join("、") : String(value)}`)
    .join(" · ");
  return preview || "事件已接收";
}

function eventTone(event: RunStreamEvent, latest: boolean) {
  if (event.type === "client.run.blocked" || event.type === "client.approval.required") {
    return "idle";
  }
  if (
    event.type.includes("failed") ||
    event.type.includes("cancelled") ||
    event.payload.status === "failed"
  ) {
    return "error";
  }
  if (
    event.type === "plan.completed" ||
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
  if (tone === "success") return <CheckCircleRounded sx={{ fontSize: 15 }} />;
  if (tone === "error") return <ErrorRounded sx={{ fontSize: 15 }} />;
  if (tone === "active") return <AutorenewRounded className="is-spinning" sx={{ fontSize: 15 }} />;
  return <PendingRounded sx={{ fontSize: 15 }} />;
}

function initialStateCopy(status: StreamStatus) {
  if (status === "blocked") return ["等待运行条件", "请先完成当前高亮的输入或审批步骤"];
  if (status === "starting") return ["准备研究上下文", "正在创建运行实例并校验任务状态"];
  if (status === "connecting") return ["建立事件通道", "正在携带访问令牌连接服务端 SSE"];
  if (status === "connected") return ["等待首个服务端事件", "连接已建立，等待 Worker 输出执行步骤"];
  if (status === "reconnecting") return ["恢复事件通道", "网络中断，正在从最后事件位置继续"];
  if (status === "failed") return ["流程需要处理", "展开查看失败步骤、错误原因与回退记录"];
  if (status === "completed") return ["流程已完成", "所有运行事件已保存，可展开审计详情"];
  return ["等待启动", "运行工作流后，这里会实时输出每一个处理步骤"];
}

function streamEventKey(event: RunStreamEvent) {
  return `${event.runId}:${event.id}`;
}

function payloadValue(value: unknown) {
  if (Array.isArray(value)) return value.join("、");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "-");
}

function EventDetails({ event }: { event: RunStreamEvent }) {
  return (
    <div className="run-trace-detail">
      <dl>
        <div>
          <dt>事件类型</dt>
          <dd>{event.type}</dd>
        </div>
        <div>
          <dt>发生时间</dt>
          <dd>{new Date(event.createdAt).toLocaleString("zh-CN", { hour12: false })}</dd>
        </div>
        <div>
          <dt>执行阶段</dt>
          <dd>{stringValue(event.payload.stage) || "运行工作流"}</dd>
        </div>
        <div>
          <dt>节点</dt>
          <dd>{event.nodeId ? nodeLabels[event.nodeId] || event.nodeId : "全局运行"}</dd>
        </div>
      </dl>
      <pre>{JSON.stringify(event.payload, null, 2)}</pre>
    </div>
  );
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
  const [viewMode, setViewMode] = useState<TraceViewMode>("timeline");
  const [selectedEventKey, setSelectedEventKey] = useState("");
  const latestEvent = events.at(-1);
  const latestEventKey = latestEvent ? streamEventKey(latestEvent) : "";
  const [emptyTitle, emptyDetail] = initialStateCopy(streamStatus);
  const planning = events.some((event) => event.runId.startsWith("planning:"));
  const rawProgress = latestEvent?.payload.progress;
  const progress =
    typeof rawProgress === "number"
      ? Math.min(100, Math.max(0, rawProgress))
      : streamStatus === "completed"
        ? 100
        : undefined;
  const active = ["starting", "connecting", "connected", "reconnecting"].includes(streamStatus);
  const canvasEvents = useMemo(() => events.slice(-12), [events]);
  const canvasNodes = useMemo(
    () =>
      canvasEvents.map((event, index) => ({
        event,
        x: 24 + index * 154,
        y: index % 2 === 0 ? 24 : 116,
      })),
    [canvasEvents],
  );
  const canvasWidth = Math.max(620, (canvasNodes.at(-1)?.x || 0) + 166);
  const selectedEvent =
    events.find((event) => streamEventKey(event) === selectedEventKey) || latestEvent;

  useEffect(() => {
    if (latestEventKey) setSelectedEventKey(latestEventKey);
  }, [latestEventKey]);

  return (
    <section className={`run-stream-trace ${open ? "is-open" : ""}`} data-guide="evidence">
      <button className="run-trace-summary" type="button" onClick={onToggle} aria-expanded={open}>
        <span className={`run-trace-mark ${active ? "is-active" : ""}`}>
          {active ? (
            <span className="run-trace-molecule" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          ) : (
            <MonitorHeartRounded sx={{ fontSize: 17 }} />
          )}
        </span>
        <span className="run-trace-title">
          <b>{planning ? "计划生成过程" : "运行过程"}</b>
          <small>{events.length ? `${events.length} 个实时步骤` : "尚未启动工作流"}</small>
        </span>
        <span className="run-trace-current">
          <b>{latestEvent ? eventLabels[latestEvent.type] || latestEvent.type : emptyTitle}</b>
          <small>{latestEvent ? eventSummary(latestEvent) : emptyDetail}</small>
        </span>
        <span className={`run-trace-connection ${streamStatus}`}>
          <i /> {statusLabels[streamStatus]}
        </span>
        <ExpandMoreRounded className="run-trace-chevron" sx={{ fontSize: 17 }} />
      </button>
      {(active || progress !== undefined) && (
        <LinearProgress
          className="run-trace-progress"
          variant={progress === undefined ? "indeterminate" : "determinate"}
          value={progress}
        />
      )}

      {open && (
        <div className="run-trace-expanded">
          <div className="run-trace-viewbar">
            <span>
              <b>执行审计</b>
              <small>时间线逐条核对，通路画布展示阶段关系。</small>
            </span>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={viewMode}
              onChange={(_, value: TraceViewMode | null) => value && setViewMode(value)}
              aria-label="运行过程展示方式"
            >
              <ToggleButton value="timeline" aria-label="时间线视图">
                <FormatListBulletedRounded sx={{ fontSize: 15 }} />
                时间线
              </ToggleButton>
              <ToggleButton value="canvas" aria-label="通路画布视图">
                <AccountTreeRounded sx={{ fontSize: 15 }} />
                通路画布
              </ToggleButton>
            </ToggleButtonGroup>
          </div>

          {viewMode === "timeline" ? (
            <div className="run-trace-events" aria-live="polite">
              {events.length === 0 && (
                <div className="run-trace-empty">
                  <PendingRounded sx={{ fontSize: 18 }} />
                  <span>{emptyDetail}</span>
                </div>
              )}
              {events.map((event, index) => {
                const tone = eventTone(event, index === events.length - 1);
                return (
                  <details className={`run-trace-event ${tone}`} key={streamEventKey(event)}>
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
                        {typeof event.payload.step === "number" && (
                          <b>
                            第 {String(event.payload.step)} /{" "}
                            {String(event.payload.totalSteps || "-")} 步
                          </b>
                        )}
                        <time>
                          {new Date(event.createdAt).toLocaleTimeString("zh-CN", {
                            hour12: false,
                          })}
                        </time>
                      </span>
                      <ExpandMoreRounded sx={{ fontSize: 15 }} />
                    </summary>
                    <EventDetails event={event} />
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="run-trace-canvas-shell" aria-live="polite">
              <div className="run-trace-canvas-viewport">
                {canvasEvents.length === 0 ? (
                  <div className="run-trace-empty">
                    <PendingRounded sx={{ fontSize: 18 }} />
                    <span>{emptyDetail}</span>
                  </div>
                ) : (
                  <div
                    className="run-trace-canvas-stage"
                    style={{ width: canvasWidth, height: 208 }}
                  >
                    <svg
                      viewBox={`0 0 ${canvasWidth} 208`}
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      {canvasNodes.slice(1).map((node, index) => {
                        const previous = canvasNodes[index];
                        const middle = (previous.x + 142 + node.x) / 2;
                        return (
                          <path
                            key={`${streamEventKey(previous.event)}-${streamEventKey(node.event)}`}
                            d={`M ${previous.x + 142} ${previous.y + 30} C ${middle} ${previous.y + 30}, ${middle} ${node.y + 30}, ${node.x} ${node.y + 30}`}
                            className={
                              index === canvasNodes.length - 2 && active ? "is-active" : ""
                            }
                          />
                        );
                      })}
                    </svg>
                    {canvasNodes.map((node, index) => {
                      const tone = eventTone(node.event, index === canvasNodes.length - 1);
                      const selected =
                        streamEventKey(node.event) ===
                        (selectedEvent ? streamEventKey(selectedEvent) : "");
                      return (
                        <button
                          type="button"
                          key={streamEventKey(node.event)}
                          className={`run-trace-canvas-node ${tone} ${selected ? "selected" : ""}`}
                          style={{ left: node.x, top: node.y }}
                          onClick={() => setSelectedEventKey(streamEventKey(node.event))}
                          aria-pressed={selected}
                        >
                          <span className="run-trace-canvas-node-head">
                            <ToneIcon tone={tone} />
                            {String(events.indexOf(node.event) + 1).padStart(2, "0")}
                          </span>
                          <b>{eventLabels[node.event.type] || node.event.type}</b>
                          <small>{stringValue(node.event.payload.stage) || "运行工作流"}</small>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {selectedEvent && (
                <aside className="run-trace-canvas-inspector">
                  <header>
                    <span className="run-trace-tone">
                      <ToneIcon tone={eventTone(selectedEvent, selectedEvent === latestEvent)} />
                    </span>
                    <div>
                      <b>{eventLabels[selectedEvent.type] || selectedEvent.type}</b>
                      <small>{eventSummary(selectedEvent)}</small>
                    </div>
                  </header>
                  <dl>
                    <div>
                      <dt>阶段</dt>
                      <dd>{stringValue(selectedEvent.payload.stage) || "运行工作流"}</dd>
                    </div>
                    <div>
                      <dt>时间</dt>
                      <dd>
                        {new Date(selectedEvent.createdAt).toLocaleTimeString("zh-CN", {
                          hour12: false,
                        })}
                      </dd>
                    </div>
                    {Object.entries(selectedEvent.payload)
                      .filter(([key]) => !["stage", "detail", "message"].includes(key))
                      .slice(0, 6)
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{payloadValue(value)}</dd>
                        </div>
                      ))}
                  </dl>
                  <pre>{JSON.stringify(selectedEvent.payload, null, 2)}</pre>
                </aside>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
