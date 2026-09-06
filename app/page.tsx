"use client";
import { useEffect, useMemo, useState } from "react";
import { ParticleLoader } from "@/components/ParticleLoader";
import { ConfigPanel } from "@/components/ConfigPanel";
import {
  ClarificationCard,
  clarificationQuestions,
  ClarificationAnswers,
} from "@/components/ClarificationCard";
import { WorkflowCanvas } from "@/components/WorkflowCanvas";
import { TaskSidebar } from "@/components/TaskSidebar";
import { ConversationPanel } from "@/components/ConversationPanel";
import { InspectorDrawer, type InspectorTab } from "@/components/InspectorDrawer";
import {
  WorkspaceModal,
  type WorkspaceModalState,
} from "@/components/WorkspaceModal";
import { defaultDemoConfig, type DemoConfig } from "@/lib/demo-config";
import { bioflowApi } from "@/lib/api-client";
import type { ResearchTask, WorkflowNodeState } from "@/lib/domain";
type TimelineEvent = {
  id: number;
  phase: string;
  title: string;
  detail: string;
  state: "done" | "active" | "idle" | "error";
  time: string;
};

const seedEvents: TimelineEvent[] = [
  {
    id: 1,
    phase: "01",
    title: "识别研究意图",
    detail: "bulk RNA-seq · 处理组 vs 对照组 · 候选基因",
    state: "done",
    time: "0.3s",
  },
  {
    id: 2,
    phase: "02",
    title: "重写分析问题",
    detail: "物种=人类 · 交付物=可发表结果",
    state: "done",
    time: "0.5s",
  },
  {
    id: 3,
    phase: "03",
    title: "检索与证据重排",
    detail: "项目文件 2 · 技能包 3 · 文献 12",
    state: "active",
    time: "1.2s",
  },
  {
    id: 4,
    phase: "04",
    title: "绑定分析依据",
    detail: "DESeq2 参数已绑定 4 条证据",
    state: "idle",
    time: "—",
  },
];

const statusLabel: Record<string, string> = {
  succeeded: "已完成",
  running: "运行中",
  blocked: "等待中",
  failed: "失败",
  queued: "排队中",
  cancelled: "已取消",
  clarifying: "待补充信息",
  awaiting_approval: "待审批",
};

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [task, setTask] = useState<ResearchTask | null>(null);
  const [events, setEvents] = useState(seedEvents);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [selected, setSelected] = useState("design");
  const [tab, setTab] = useState<InspectorTab>("todo");
  const [mobilePanel, setMobilePanel] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sentMessages, setSentMessages] = useState<string[]>([]);
  const [agentReplies, setAgentReplies] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [submittingAnswers, setSubmittingAnswers] = useState(false);
  const [approvingPlan, setApprovingPlan] = useState(false);
  const [cancellingRun, setCancellingRun] = useState(false);
  const [answers, setAnswers] = useState<ClarificationAnswers>({
    format: "",
    comparison: "",
    organism: "",
    deliverable: "",
  });
  const [codeText, setCodeText] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [inspectorWidth, setInspectorWidth] = useState(320);
  const [evidenceHeight, setEvidenceHeight] = useState(92);
  const [resizing, setResizing] = useState<
    "sidebar" | "inspector" | "evidence" | null
  >(null);
  const [structureAngle, setStructureAngle] = useState(18);
  const [selectedResidue, setSelectedResidue] = useState<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [planOpen, setPlanOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [extraEdges, setExtraEdges] = useState<string[][]>([]);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [nodePositions, setNodePositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [activeNav, setActiveNav] = useState<"workspace" | "skills" | "files">(
    "workspace",
  );
  const [activeTask, setActiveTask] = useState("rna");
  const [projectName, setProjectName] = useState("BioFlow 生命科学实验室");
  const [modal, setModal] = useState<WorkspaceModalState | null>(null);
  const [toast, setToast] = useState("");
  const [agentMode, setAgentMode] = useState<
    "标准模式" | "严谨模式" | "快速模式"
  >("标准模式");
  const [extraTasks, setExtraTasks] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [newTaskName, setNewTaskName] = useState("");
  const [config, setConfig] = useState<DemoConfig>(defaultDemoConfig);
  const [configOpen, setConfigOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  useEffect(() => {
    const syncViewport = () => setViewportWidth(window.innerWidth);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobilePanel(false);
        setModal(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    (async () => {
      try {
        await bioflowApi.login();
        const [taskResponse, configResponse] = await Promise.all([
          bioflowApi.getTask(),
          bioflowApi.getConfig(),
          new Promise((resolve) => setTimeout(resolve, 850)),
        ]);
        setTask(taskResponse.task);
        if (configResponse.config) setConfig(configResponse.config);
        setAuthed(true);
      } catch {
        setToast("工作区初始化失败，请检查服务状态");
      }
    })();
  }, []);
  useEffect(() => {
    if (!authed || !running) return;
    const sync = () =>
      bioflowApi.getTask().then((response) => {
        if (response.task) {
          setTask(response.task);
          if (["failed", "succeeded", "cancelled"].includes(response.task.status)) {
            setRunning(false);
          }
        }
      }).catch(() => undefined);
    sync();
    const timer = setInterval(sync, 300);
    return () => clearInterval(timer);
  }, [authed, running]);
  useEffect(() => {
    if (!authed || !task) return;
    const sync = () =>
      bioflowApi.getTask().then((response) => setTask(response.task)).catch(() => undefined);
    const es = new EventSource("/api/runs/run_demo_001/events");
    es.onmessage = (message) => {
      try {
        const e = JSON.parse(message.data);
        setLiveLogs((logs) =>
          [
            ...logs,
            `[${new Date(e.createdAt).toLocaleTimeString()}] ${e.type}${
              e.nodeId ? ` · ${e.nodeId}` : ""
            }`,
          ].slice(-100)
        );
        if (e.type === "code.delta" && typeof e.payload?.text === "string") {
          setCodeText((v) => v + e.payload.text);
        }
        const map: any = {
          "intent.detected": {
            id: 1,
            state: "done",
            detail: "bulk RNA-seq · 处理组 vs 对照组",
            time: "0.3s",
          },
          "retrieval.started": {
            id: 3,
            state: "active",
            detail: "正在检索项目文件、技能包与文献",
            time: "…",
          },
          "retrieval.hit": {
            id: 3,
            state: "active",
            detail: `项目文件 ${e.payload?.projectFiles || 2} · 技能包 ${
              e.payload?.skills || 3
            } · 文献 ${e.payload?.literature || 12}`,
            time: "1.2s",
          },
          "evidence.reranked": {
            id: 3,
            state: "done",
            detail: `保留 ${e.payload?.kept || 4} 条高相关证据`,
            time: "1.8s",
          },
          "grounding.bound": {
            id: 4,
            state: "done",
            detail: "参数已绑定证据，可进入执行",
            time: "2.1s",
          },
        };
        if (map[e.type]) {
          setEvents((items) =>
            items.map((item) =>
              item.id === map[e.type].id ? { ...item, ...map[e.type] } : item
            )
          );
        }
      } catch {}
      sync();
    };
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, [authed]);
  useEffect(() => {
    if (tab !== "structure") return;
    const canvas = document.querySelector<HTMLElement>(".structure-canvas");
    if (!canvas) return;
    let down = false, lastX = 0;
    const move = (e: PointerEvent) => {
      if (!down) return;
      setStructureAngle((a) => a + (e.clientX - lastX) * .7);
      lastX = e.clientX;
    };
    const start = (e: PointerEvent) => {
      down = true;
      lastX = e.clientX;
      canvas.setPointerCapture?.(e.pointerId);
    };
    const end = () => {
      down = false;
    };
    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointerleave", end);
    return () => {
      canvas.removeEventListener("pointerdown", start);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", end);
      canvas.removeEventListener("pointerleave", end);
    };
  }, [tab]);
  useEffect(() => {
    const canvas = document.querySelector<HTMLElement>(".structure-canvas");
    if (canvas) {
      canvas.style.setProperty("--structure-angle", `${structureAngle}deg`);
      canvas.style.setProperty(
        "--structure-shift",
        `${Math.sin(structureAngle / 28) * 18}px`,
      );
    }
  }, [structureAngle, tab]);
  const node = useMemo(() => task?.nodes.find((n) => n.id === selected), [
    task,
    selected,
  ]);
  useEffect(() => {
    if (selectedResidue) {
      notify(`已选择残基 ${selectedResidue}，证据与代码上下文已关联`);
    }
  }, [selectedResidue]);
  const notify = (message: string) => setToast(message);
  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      const configResponse = await bioflowApi.saveConfig(config);
      setConfig(configResponse.config);
      const taskResponse = await bioflowApi.getTask();
      setTask(taskResponse.task);
      setConfigOpen(false);
      notify("演示配置已应用");
    } catch {
      notify("配置保存失败，请检查服务状态");
    }
    setConfigSaving(false);
  };
  const openTool = (nextTab: typeof tab) => {
    setTab(nextTab);
    setMobilePanel(true);
  };
  const switchNav = (next: "workspace" | "skills" | "files") => {
    setActiveNav(next);
    if (next === "workspace") {
      setModal(null);
      document.querySelector(".workspace")?.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      notify("已回到智能体工作台");
    } else {setModal({
        kind: next,
        title: next === "skills" ? "能力中心" : "项目文件",
      });}
  };
  const shareTask = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      notify("任务链接已复制到剪贴板");
    } catch {
      setModal({ kind: "file", title: "分享任务", detail: url });
    }
  };
  const downloadVolcano = () => {
    const svg = document.querySelector(".volcano")?.outerHTML;
    if (!svg) {
      notify("结果图尚未生成");
      return;
    }
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "volcano_plot.svg";
    anchor.click();
    URL.revokeObjectURL(url);
    notify("火山图 SVG 已下载");
  };
  const downloadReport = () => {
    const report = `# RNA-seq 候选基因分析报告

## 分析目标

${task?.goal || config.goal}

## 运行摘要

- 结果版本：v1.0.0
- 统计模型：DESeq2
- FDR 阈值：0.05
- 结果血缘：counts.csv → 设计矩阵 → DESeq2 → volcano_plot.svg

## 结论

本次演示已完成差异表达分析，并生成火山图、分析代码和可复现参数快照。
`;
    const url = URL.createObjectURL(new Blob([report], { type: "text/markdown" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "analysis_report.md";
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Markdown 分析报告已下载");
  };
  const selectTask = (id: string, label: string, nextTab?: typeof tab) => {
    setActiveTask(id);
    if (id === "rna") {
      setMobilePanel(false);
      notify("已切换到 RNA-seq 差异表达分析");
    } else if (nextTab) {
      openTool(nextTab);
      notify(`已打开${label}`);
    } else notify(`已切换到${label}`);
  };
  const createTask = () => {
    const name = newTaskName.trim();
    if (!name) {
      notify("请先填写任务名称");
      return;
    }
    setExtraTasks((items) => [...items, name]);
    setNewTaskName("");
    setModal(null);
    setActiveTask(`extra-${extraTasks.length}`);
    notify(`已创建任务：${name}`);
  };
  const submitClarifications = async () => {
    if (submittingAnswers || Object.values(answers).some((v) => !v)) return;
    setSubmittingAnswers(true);
    try {
      const response = await bioflowApi.submitClarifications({ answers });
      setTask(response.task);
    } catch {
      notify("澄清信息提交失败，请检查服务状态");
    } finally {
      setSubmittingAnswers(false);
    }
  };
  const approvePlan = async () => {
    if (approvingPlan) return;
    setApprovingPlan(true);
    try {
      const response = await bioflowApi.approvePlan();
      setTask(response.task);
      notify("分析计划已批准，等待运行");
    } catch {
      notify("分析计划审批失败，请检查服务状态");
    } finally {
      setApprovingPlan(false);
    }
  };
  const runDemo = async () => {
    if (running) {
      notify("工作流正在运行，请稍候");
      return;
    }
    if (task?.status === "clarifying") {
      notify("请先完成四项分析信息");
      return;
    }
    if (task?.status === "awaiting_approval") {
      notify("请先批准分析计划");
      return;
    }
    setRunning(true);
    notify("工作流已开始运行");
    try {
      await bioflowApi.startRun();
    } catch {
      setRunning(false);
      notify("启动失败，请检查服务状态");
      return;
    }
    setTimeout(() => setRunning(false), 1800);
  };
  const retry = async () => {
    setRetrying(true);
    setCodeText("");
    try {
      await bioflowApi.retryNode("run_demo_001", "design");
      setTimeout(() => setRetrying(false), 1300);
    } catch {
      setRetrying(false);
      notify("节点重试失败，请检查服务状态");
    }
  };
  const sendMessage = () => {
    const text = messageText.trim();
    if (!text) {
      notify("请输入问题后再发送");
      return;
    }
    setSentMessages((items) => [...items, text]);
    setMessageText("");
    setTimeout(
      () =>
        setAgentReplies(
          (items) => [
            ...items,
            `已收到。我会按${agentMode}结合当前项目文件和分析上下文，给出下一步可执行建议。`,
          ],
        ),
      220,
    );
  };
  const cancel = async () => {
    if (cancellingRun) return;
    setCancellingRun(true);
    try {
      await bioflowApi.cancelRun("run_demo_001");
      const taskResponse = await bioflowApi.getTask();
      setTask(taskResponse.task);
      setRunning(false);
      notify("运行已取消");
    } catch {
      notify("取消失败，请稍后重试");
    } finally {
      setCancellingRun(false);
    }
  };
  const startResize = (
    kind: "sidebar" | "inspector" | "evidence",
    event: React.PointerEvent,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(kind);
    const startX = event.clientX,
      startY = event.clientY,
      base = kind === "sidebar"
        ? sidebarWidth
        : kind === "inspector"
        ? inspectorWidth
        : evidenceHeight;
    const move = (e: PointerEvent) => {
      if (kind === "sidebar") {
        setSidebarWidth(
          Math.min(390, Math.max(210, base + e.clientX - startX)),
        );
      }
      if (kind === "inspector") {
        setInspectorWidth(
          Math.min(520, Math.max(260, base + startX - e.clientX)),
        );
      }
      if (kind === "evidence") {
        setEvidenceHeight(
          Math.min(220, Math.max(70, base + e.clientY - startY)),
        );
      }
    };
    const up = () => {
      setResizing(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const clampZoom = (value: number) => Math.min(1.6, Math.max(.55, value));
  const startCanvasPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY },
      base = { ...canvasPan };
    const move = (e: PointerEvent) =>
      setCanvasPan({
        x: base.x + e.clientX - start.x,
        y: base.y + e.clientY - start.y,
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const startNodeDrag = (
    node: WorkflowNodeState,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey) {
      if (connectingFrom && connectingFrom !== node.id) {
        setExtraEdges((items) => [...items, [connectingFrom, node.id]]);
        setConnectingFrom(null);
      } else setConnectingFrom(node.id);
      return;
    }
    setSelected(node.id);
    const origin = nodePositions[node.id] || { x: node.x, y: node.y };
    const start = { x: event.clientX, y: event.clientY };
    let moved = false;
    const move = (e: PointerEvent) => {
      moved = true;
      setNodePositions((items) => ({
        ...items,
        [node.id]: {
          x: Math.max(0, origin.x + (e.clientX - start.x) / canvasZoom),
          y: Math.max(0, origin.y + (e.clientY - start.y) / canvasZoom),
        },
      }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) {
        setTab("evidence");
        setMobilePanel(true);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const resetCanvas = () => {
    setCanvasZoom(1);
    setCanvasPan({ x: 0, y: 0 });
    setNodePositions({});
    setConnectingFrom(null);
    notify("画布位置和缩放已重置");
  };
  if (!authed || !task) {
    return (
      <main className="boot">
        <ParticleLoader />
        <div className="boot-content">
          <div className="boot-mark">⦿</div>
          <p>正在初始化安全科研工作区…</p>
          <small>正在连接任务状态 · 加载证据索引</small>
        </div>
      </main>
    );
  }
  return (
    <main
      className={`app-shell ${resizing ? "is-resizing" : ""}`}
      style={{
        gridTemplateColumns: `68px ${
          viewportWidth <= 1500 ? Math.min(sidebarWidth, 220) : sidebarWidth
        }px minmax(0,1fr)`,
      }}
    >
      <aside className="rail">
        <div className="brand">⦿</div>
        <button
          className={`rail-btn ${activeNav === "workspace" ? "active" : ""}`}
          onClick={() => switchNav("workspace")}
        >
          ⌘<span>工作台</span>
        </button>
        <button
          className={`rail-btn ${activeNav === "skills" ? "active" : ""}`}
          onClick={() => switchNav("skills")}
        >
          ◇<span>能力中心</span>
        </button>
        <button
          className={`rail-btn ${activeNav === "files" ? "active" : ""}`}
          onClick={() => switchNav("files")}
        >
          ◈<span>文件</span>
        </button>
        <div className="rail-spacer" />
        <button
          className="avatar"
          onClick={() => notify("当前登录：DF · 研究员")}
          aria-label="查看当前账户"
        >
          DF
        </button>
      </aside>
      <TaskSidebar
        task={task}
        projectName={projectName}
        activeTaskId={activeTask}
        extraTaskNames={extraTasks}
        uploadedFileNames={uploadedFiles}
        statusLabels={statusLabel}
        onOpenProjectPicker={() =>
          setModal({ kind: "projects", title: "切换项目" })
        }
        onCreateTask={() =>
          setModal({ kind: "new-task", title: "新建科研任务" })
        }
        onSelectTask={selectTask}
        onUploadFile={() => setModal({ kind: "upload", title: "上传项目文件" })}
        onOpenFile={(fileName, fileDetail) =>
          setModal({ kind: "file", title: fileName, detail: fileDetail })
        }
        onResizeStart={(event) => startResize("sidebar", event)}
      />
      <section className="workspace">
        <header className="topbar">
          <div className="crumb">
            <span>快捷任务</span>
            <b>/</b>
            <strong>{task.title}</strong>
          </div>
          <div className="top-actions">
            <span className="live">
              <i /> 智能体运行 39 秒
            </span>
            <button onClick={shareTask}>分享</button>
            <button
              onClick={() => setModal({ kind: "layout", title: "工作区布局" })}
            >
              布局
            </button>
          </div>
        </header>
        <div className="goal-strip">
          <div>
            <small>当前研究目标 · 生物信息学</small>
            <h1>{task.goal}</h1>
          </div>
          <div className="goal-actions">
            <span className={`status-pill ${task.status}`}>
              ● {statusLabel[task.status] || task.status}
            </span>
            <button className="secondary" onClick={() => setConfigOpen(true)}>
              配置
            </button>
            <button
              className="secondary"
              onClick={() => setPlanOpen((v) => !v)}
            >
              {planOpen ? "收起计划" : "分析计划"}
            </button>
            <button
              className="secondary"
              onClick={() => setMobilePanel(!mobilePanel)}
            >
              工具
            </button>
            {task.status === "running" && (
              <button
                className="secondary danger"
                onClick={cancel}
                disabled={cancellingRun}
              >
                {cancellingRun ? "取消中…" : "取消"}
              </button>
            )}
            <button className="primary" onClick={runDemo}>
              {running ? "运行中…" : "运行工作流"}
            </button>
          </div>
        </div>
        <div className="dialogue-thread">
          <div className="user-message">
            <small>你 · 刚刚</small>
            <p>
              我有 RNA-seq
              数据，希望比较处理组与对照组，找出显著差异基因并生成火山图。
            </p>
          </div>
          <div className="agent-message">
            <div className="assistant-avatar">✦</div>
            <div>
              <small>BioFlow 智能体</small>
              <p>
                可以。我会先检查项目文件，再确认数据格式、实验设计和交付要求，然后生成一份可审批的分析计划。
              </p>
              <button
                className="trace-chip"
                onClick={() => setTraceOpen((v) => !v)}
              >
                {traceOpen ? "收起执行轨迹" : "✓ 已检查项目文件 · 查看执行轨迹"}
              </button>
            </div>
          </div>
        </div>
        <div
          className={`evidence-strip ${traceOpen ? "" : "trace-collapsed"}`}
          style={{ height: evidenceHeight }}
        >
          <div className="evidence-label">
            <span>✦</span>
            <b>证据流水线</b>
            <small>智能体决策追踪</small>
          </div>
          {events.map((e) => (
            <button
              key={e.id}
              className={`evidence-step ${e.state}`}
              onClick={() => openTool("evidence")}
            >
              <span className="phase">{e.phase}</span>
              <span>
                <b>{e.title}</b>
                <small>{e.detail}</small>
              </span>
              <em>{e.time}</em>
            </button>
          ))}
          <div
            className="horizontal-splitter"
            onPointerDown={(e) => startResize("evidence", e)}
            title="拖拽调整证据区高度"
          />
        </div>
        {task?.status === "clarifying" && (
          <ClarificationCard
            answers={answers}
            activeQuestion={activeQuestion}
            submitting={submittingAnswers}
            onActiveQuestionChange={setActiveQuestion}
            onAnswer={(key, value, index) => {
              setAnswers((current) => ({ ...current, [key]: value }));
              if (index < clarificationQuestions.length - 1) {
                setTimeout(() => setActiveQuestion(index + 1), 180);
              }
            }}
            onSubmit={submitClarifications}
          />
        )}
        {task?.status === "awaiting_approval" && (
          <div className="gate-card approval">
            <div className="gate-head">
              <div>
                <small>分析计划待确认</small>
                <h2>RNA-seq 候选基因分析工作流</h2>
                <p>
                  共 6 步 · 预计 2 分 30 秒 · 已绑定 3 个证据来源 ·
                  不向外部传输数据
                </p>
              </div>
              <span className="status-pill blocked">等待审批</span>
            </div>
            <div className="plan-preview">
              <span>01 校验数据结构</span>
              <span>02 构建设计矩阵</span>
              <span>03 执行 DESeq2</span>
              <span>04 生成火山图</span>
              <span>05 排序候选基因</span>
              <span>06 撰写科研报告</span>
            </div>
            <div className="approval-actions">
              <button
                className="secondary"
                onClick={() => openTool("evidence")}
              >
                查看证据
              </button>
              <button
                className="primary"
                onClick={approvePlan}
                disabled={approvingPlan}
              >
                {approvingPlan ? "审批中…" : "批准并执行 →"}
              </button>
            </div>
          </div>
        )}
        <WorkflowCanvas
          open={planOpen}
          nodes={task.nodes}
          edges={task.edges}
          extraEdges={extraEdges}
          selected={selected}
          connectingFrom={connectingFrom}
          canvasZoom={canvasZoom}
          canvasPan={canvasPan}
          nodePositions={nodePositions}
          onZoomChange={(update) => setCanvasZoom((value) => clampZoom(update(value)))}
          onReset={resetCanvas}
          onCanvasPanStart={startCanvasPan}
          onCanvasWheel={(event) => {
            event.preventDefault();
            setCanvasZoom((value) =>
              clampZoom(value + (event.deltaY < 0 ? 0.08 : -0.08)),
            );
          }}
          onNodePointerDown={startNodeDrag}
        />
        <ConversationPanel
          sentMessages={sentMessages}
          agentReplies={agentReplies}
          taskStatus={task.status}
          messageText={messageText}
          agentMode={agentMode}
          onMessageTextChange={setMessageText}
          onSendMessage={sendMessage}
          onAddFile={() => setModal({ kind: "upload", title: "添加项目文件" })}
          onAgentModeChange={() => {
            const nextMode = agentMode === "标准模式"
              ? "严谨模式"
              : agentMode === "严谨模式"
              ? "快速模式"
              : "标准模式";
            setAgentMode(nextMode);
            notify(`已切换为${nextMode}`);
          }}
          onOpenFailureEvidence={() => {
            setSelected("design");
            openTool("evidence");
          }}
          onOpenCode={() => openTool("code")}
        />
      </section>
      <nav className="tool-dock" aria-label="研究工具">
        {[["todo", "待办", "☷"], ["results", "结果", "▧"], [
          "compute",
          "计算",
          "◉",
        ], ["notes", "笔记", "✎"]].map(([key, label, icon]) => (
          <button
            key={key}
            className={tab === key && mobilePanel ? "active" : ""}
            onClick={() => {
              setTab(key as typeof tab);
              setMobilePanel(true);
            }}
          >
            <i>{icon}</i>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {mobilePanel && (
        <button
          className="inspector-backdrop"
          aria-label="关闭检查器"
          onClick={() => setMobilePanel(false)}
        />
      )}
      <InspectorDrawer
        isOpen={mobilePanel}
        activeTab={tab}
        selectedNode={node}
        statusLabels={statusLabel}
        answers={answers}
        liveLogs={liveLogs}
        running={running}
        retrying={retrying}
        codeText={codeText}
        selectedResidue={selectedResidue}
        artifacts={task.artifacts}
        onTabChange={setTab}
        onClose={() => setMobilePanel(false)}
        onSelectQuestion={(questionIndex) => {
          setActiveQuestion(questionIndex);
          setMobilePanel(false);
          notify(`已定位到${clarificationQuestions[questionIndex].label}`);
        }}
        onOpenSource={(title, detail) =>
          setModal({ kind: "source", title, detail })
        }
        onRetry={retry}
        onRunDemo={runDemo}
        onDownloadVolcano={downloadVolcano}
        onSelectResultSource={() => {
          setSelected("de");
          setTab("evidence");
          notify("已追溯到 DESeq2 来源节点");
        }}
        onResidueSelect={setSelectedResidue}
        onOpenMolstar={() =>
          notify("当前为轻量 3D 预览；接入 Mol* 后将在此打开完整结构查看器")
        }
        onDownloadReport={downloadReport}
        onResizeStart={(event) => startResize("inspector", event)}
      />
      {modal && (
        <WorkspaceModal
          modal={modal}
          projectName={projectName}
          uploadedFileNames={uploadedFiles}
          newTaskName={newTaskName}
          onClose={() => setModal(null)}
          onSelectProject={(nextProjectName) => {
            setProjectName(nextProjectName);
            setModal(null);
            notify(`已切换到${nextProjectName}`);
          }}
          onSelectSkill={(skillName, skillState) =>
            notify(`${skillName}：${skillState}`)
          }
          onOpenFile={(fileName, detail) => setModal({ kind: "file", title: fileName, detail })}
          onNewTaskNameChange={setNewTaskName}
          onCreateTask={createTask}
          onUploadFiles={(fileNames) => {
            setUploadedFiles((items) => [...items, ...fileNames]);
            setModal(null);
            notify(`已添加 ${fileNames.length} 个文件`);
          }}
          onApplyLayout={(layout) => {
            if (layout === "focus") {
              setPlanOpen(false);
              setTraceOpen(false);
              setMobilePanel(false);
              setModal(null);
              notify("已切换为对话专注布局");
              return;
            }
            if (layout === "workflow") {
              setPlanOpen(true);
              setModal(null);
              notify("已展开工作流布局");
              return;
            }
            setSidebarWidth(260);
            setInspectorWidth(320);
            setEvidenceHeight(92);
            setPlanOpen(false);
            setTraceOpen(false);
            setMobilePanel(false);
            resetCanvas();
            setModal(null);
          }}
          onConfirmDetail={(kind) => {
            setModal(null);
            notify(kind === "source" ? "已定位到关联证据" : "文件预览已确认");
          }}
        />
      )}
      {toast && (
        <div className="ui-toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
      {configOpen && (
        <ConfigPanel
          config={config}
          onChange={setConfig}
          onSave={saveConfig}
          onClose={() => setConfigOpen(false)}
          saving={configSaving}
        />
      )}
      <button
        className="mobile-inspector-trigger"
        onClick={() => setMobilePanel(true)}
      >
        检查器 · {node?.label}
      </button>
    </main>
  );
}
