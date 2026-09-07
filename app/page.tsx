"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ParticleLoader } from "@/components/ParticleLoader";
import { ConfigPanel } from "@/components/ConfigPanel";
import {
  ClarificationCard,
  clarificationQuestions,
  ClarificationAnswers,
} from "@/components/ClarificationCard";
import { WorkflowCanvas, type LayoutSaveState } from "@/components/WorkflowCanvas";
import { TaskSidebar } from "@/components/TaskSidebar";
import { ConversationPanel } from "@/components/ConversationPanel";
import { InspectorDrawer, type InspectorTab } from "@/components/InspectorDrawer";
import { WorkspaceModal, type WorkspaceModalState } from "@/components/WorkspaceModal";
import { ProductGuide } from "@/components/ProductGuide";
import { DocumentationDrawer } from "@/components/DocumentationDrawer";
import { RealAnalysisPanel } from "@/components/RealAnalysisPanel";
import { defaultDemoConfig, type DemoConfig } from "@/lib/demo-config";
import { bioflowApi, getApiErrorMessage } from "@/lib/api-client";
import type {
  ConversationMessage,
  DataFileProfile,
  RagTrace,
  ResearchTask,
  TaskListItem,
  WorkflowNodeState,
} from "@/lib/domain";
type TimelineEvent = {
  id: number;
  phase: string;
  title: string;
  detail: string;
  state: "done" | "active" | "idle" | "error";
  time: string;
};

type RunStreamEvent = {
  type: string;
  createdAt: string;
  nodeId?: string;
  payload?: Record<string, unknown>;
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
  draft: "草稿",
  succeeded: "已完成",
  running: "运行中",
  blocked: "等待中",
  failed: "失败",
  queued: "排队中",
  cancelled: "已取消",
  clarifying: "待补充信息",
  awaiting_approval: "待审批",
};

/** BioFlow Studio 主工作台，负责领域状态编排，不承载具体工具视图实现。 */
export default function Home() {
  const router = useRouter();
  const params = useParams<{ taskId?: string }>();
  const pathname = usePathname();
  const routeTaskId = params?.taskId || "task_demo_rnaseq";
  const [authed, setAuthed] = useState(false);
  const [task, setTask] = useState<ResearchTask | null>(null);
  const [events, setEvents] = useState(seedEvents);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [selected, setSelected] = useState("design");
  const [tab, setTab] = useState<InspectorTab>("todo");
  const [mobilePanel, setMobilePanel] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [notes, setNotes] = useState("");
  const [streamStatus, setStreamStatus] = useState<"connected" | "reconnecting" | "disconnected">(
    "disconnected",
  );
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
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
  const [codeStreaming, setCodeStreaming] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [inspectorWidth, setInspectorWidth] = useState(320);
  const [evidenceHeight, setEvidenceHeight] = useState(92);
  const [resizing, setResizing] = useState<"sidebar" | "inspector" | "evidence" | null>(null);
  const [selectedResidue, setSelectedResidue] = useState<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [planOpen, setPlanOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [extraEdges, setExtraEdges] = useState<string[][]>([]);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [layoutReady, setLayoutReady] = useState(false);
  const [layoutSaveState, setLayoutSaveState] = useState<LayoutSaveState>("loading");
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [layoutVersionCount, setLayoutVersionCount] = useState(0);
  const [creatingLayoutVersion, setCreatingLayoutVersion] = useState(false);
  const lastSavedLayoutRef = useRef("");
  const conversationHydratedRef = useRef(false);
  const notesHydratedRef = useRef(false);
  const [activeNav, setActiveNav] = useState<"workspace" | "skills" | "files">("workspace");
  const [activeTask, setActiveTask] = useState(routeTaskId);
  const [projectName, setProjectName] = useState("BioFlow 生命科学实验室");
  const [modal, setModal] = useState<WorkspaceModalState | null>(null);
  const [toast, setToast] = useState("");
  const [agentMode, setAgentMode] = useState<"标准模式" | "严谨模式" | "快速模式">("标准模式");
  const [taskList, setTaskList] = useState<TaskListItem[]>([]);
  const [dataProfiles, setDataProfiles] = useState<DataFileProfile[]>([]);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [newTaskName, setNewTaskName] = useState("");
  const [config, setConfig] = useState<DemoConfig>(defaultDemoConfig);
  const [configOpen, setConfigOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [skipBoot, setSkipBoot] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [initializationError, setInitializationError] = useState("");
  const [ragTrace, setRagTrace] = useState<RagTrace | null>(null);
  const guideInitializedRef = useRef(false);
  const uploadedFiles = useMemo(
    () => dataProfiles.map((profile) => profile.fileName),
    [dataProfiles],
  );
  const workflowLayoutInput = useMemo(
    () => ({
      nodePositions,
      extraEdges,
      zoom: canvasZoom,
      pan: canvasPan,
    }),
    [canvasPan, canvasZoom, extraEdges, nodePositions],
  );
  const serializedWorkflowLayout = useMemo(
    () => JSON.stringify(workflowLayoutInput),
    [workflowLayoutInput],
  );
  useEffect(() => {
    setActiveTask(routeTaskId);
    setTask(null);
    setConversationMessages([]);
    setNotes("");
    setAnswers({ format: "", comparison: "", organism: "", deliverable: "" });
    conversationHydratedRef.current = false;
    notesHydratedRef.current = false;
    setEvents(seedEvents);
    setRagTrace(null);
    setSelectedEvidenceId(null);
    setRunning(false);
    setCodeText("");
    setCodeStreaming(false);
    setLiveLogs([]);
    setStreamStatus("disconnected");
    setLayoutReady(false);
    setLayoutSaveState("loading");
    lastSavedLayoutRef.current = "";
  }, [routeTaskId]);
  useEffect(() => {
    const syncViewport = () => setViewportWidth(window.innerWidth);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);
  useEffect(() => {
    if (pathname?.startsWith("/skills")) setActiveNav("skills");
    else if (pathname?.startsWith("/files")) setActiveNav("files");
    else setActiveNav("workspace");
  }, [pathname]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobilePanel(false);
        setModal(null);
        setGuideOpen(false);
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
    if (!authed || !task || guideInitializedRef.current) return;
    guideInitializedRef.current = true;
    if (!window.localStorage.getItem("bioflow-studio-guide-v1")) {
      setGuideOpen(true);
    }
  }, [authed, task]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setInitializationError("");
        await bioflowApi.login();
        const [taskResponse, configResponse, layoutResponse, conversationResponse, notesResponse] =
          await Promise.all([
            bioflowApi.getTask(routeTaskId),
            bioflowApi.getConfig(),
            bioflowApi.getWorkflowLayout(routeTaskId),
            bioflowApi.getConversation(routeTaskId),
            bioflowApi.getNotes(routeTaskId),
            new Promise((resolve) => setTimeout(resolve, 850)),
          ]);
        if (cancelled) return;
        setTask(taskResponse.task);
        setRunning(taskResponse.task.status === "running");
        setTaskList(taskResponse.tasks ?? []);
        setDataProfiles(taskResponse.task.dataProfiles ?? []);
        setAnswers({
          format: taskResponse.task.clarification?.answers?.format || "",
          comparison: taskResponse.task.clarification?.answers?.comparison || "",
          organism: taskResponse.task.clarification?.answers?.organism || "",
          deliverable: taskResponse.task.clarification?.answers?.deliverable || "",
        });
        setConversationMessages(conversationResponse.messages ?? []);
        setNotes(notesResponse.notes ?? taskResponse.task.notes ?? "");
        conversationHydratedRef.current = true;
        notesHydratedRef.current = true;
        if (configResponse.config) setConfig(configResponse.config);
        const restoredLayout = layoutResponse.layout.current;
        const restoredLayoutInput = {
          nodePositions: restoredLayout.nodePositions,
          extraEdges: restoredLayout.extraEdges,
          zoom: restoredLayout.zoom,
          pan: restoredLayout.pan,
        };
        setNodePositions(restoredLayout.nodePositions);
        setExtraEdges(restoredLayout.extraEdges);
        setCanvasZoom(restoredLayout.zoom);
        setCanvasPan(restoredLayout.pan);
        setLayoutRevision(restoredLayout.revision);
        setLayoutVersionCount(layoutResponse.layout.versions.length);
        lastSavedLayoutRef.current = JSON.stringify(restoredLayoutInput);
        setLayoutReady(true);
        setLayoutSaveState("saved");
        setAuthed(true);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "工作区初始化失败，请检查服务状态";
        setInitializationError(message);
        setToast(getApiErrorMessage(error, "工作区初始化失败，请检查服务状态"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootAttempt, routeTaskId]);
  useEffect(() => {
    if (!authed || !task || task.id !== activeTask || !conversationHydratedRef.current) return;
    const saveTimer = window.setTimeout(() => {
      void bioflowApi.saveConversation(activeTask, conversationMessages).catch(() => undefined);
    }, 450);
    return () => window.clearTimeout(saveTimer);
  }, [activeTask, authed, conversationMessages, task?.id]);
  useEffect(() => {
    if (!authed || !task || task.id !== activeTask || !notesHydratedRef.current) return;
    const saveTimer = window.setTimeout(() => {
      void bioflowApi.saveNotes(activeTask, notes).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(saveTimer);
  }, [activeTask, authed, notes, task?.id]);
  useEffect(() => {
    if (!authed || !layoutReady || serializedWorkflowLayout === lastSavedLayoutRef.current) return;

    setLayoutSaveState("saving");
    let saveCancelled = false;
    const saveTimer = window.setTimeout(async () => {
      try {
        const response = await bioflowApi.saveWorkflowLayout(workflowLayoutInput, activeTask);
        if (saveCancelled) return;
        lastSavedLayoutRef.current = serializedWorkflowLayout;
        setLayoutRevision(response.layout.current.revision);
        setLayoutVersionCount(response.layout.versions.length);
        setLayoutSaveState("saved");
      } catch {
        if (!saveCancelled) setLayoutSaveState("error");
      }
    }, 650);

    return () => {
      saveCancelled = true;
      window.clearTimeout(saveTimer);
    };
  }, [activeTask, authed, layoutReady, serializedWorkflowLayout, workflowLayoutInput]);
  useEffect(() => {
    if (!authed || !running) return;
    const sync = () =>
      bioflowApi
        .getTask(activeTask)
        .then((response) => {
          if (response.task) {
            setTask(response.task);
            if (response.tasks) setTaskList(response.tasks);
            if (["failed", "succeeded", "cancelled"].includes(response.task.status)) {
              setRunning(false);
            }
          }
        })
        .catch(() => undefined);
    sync();
    const timer = setInterval(sync, 300);
    return () => clearInterval(timer);
  }, [activeTask, authed, running]);
  useEffect(() => {
    if (!authed || !task?.runId) {
      setStreamStatus("disconnected");
      return;
    }
    const sync = () =>
      bioflowApi
        .getTask(activeTask)
        .then((response) => {
          setTask(response.task);
          if (response.tasks) setTaskList(response.tasks);
        })
        .catch(() => undefined);
    const es = new EventSource(`/api/runs/${encodeURIComponent(task.runId)}/events`);
    es.onopen = () => setStreamStatus("connected");
    es.onmessage = (message) => {
      try {
        const runEvent = JSON.parse(message.data) as RunStreamEvent;
        setLiveLogs((logs) =>
          [
            ...logs,
            `[${new Date(runEvent.createdAt).toLocaleTimeString()}] ${runEvent.type}${
              runEvent.nodeId ? ` · ${runEvent.nodeId}` : ""
            }`,
          ].slice(-100),
        );
        if (runEvent.type === "code.delta" && typeof runEvent.payload?.text === "string") {
          const codeDelta = runEvent.payload.text;
          setCodeStreaming(true);
          setCodeText((currentCode) => currentCode + codeDelta);
        }
        if (
          runEvent.type === "rag.trace.created" &&
          typeof runEvent.payload?.traceId === "string"
        ) {
          void bioflowApi
            .getRagTrace(runEvent.payload.traceId)
            .then((response) => setRagTrace(response.trace))
            .catch(() => undefined);
        }
        if (runEvent.type === "code.completed") setCodeStreaming(false);
        const timelineUpdates: Record<string, Partial<TimelineEvent> & { id: number }> = {
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
            detail: `项目文件 ${runEvent.payload?.projectFiles || 2} · 技能包 ${
              runEvent.payload?.skills || 3
            } · 文献 ${runEvent.payload?.literature || 12}`,
            time: "1.2s",
          },
          "evidence.reranked": {
            id: 3,
            state: "done",
            detail: `保留 ${runEvent.payload?.kept || 4} 条高相关证据`,
            time: "1.8s",
          },
          "grounding.bound": {
            id: 4,
            state: "done",
            detail: "参数已绑定证据，可进入执行",
            time: "2.1s",
          },
        };
        const timelineUpdate = timelineUpdates[runEvent.type];
        if (timelineUpdate) {
          setEvents((items) =>
            items.map((item) =>
              item.id === timelineUpdate.id ? { ...item, ...timelineUpdate } : item,
            ),
          );
        }
      } catch {}
      sync();
    };
    es.onerror = () => setStreamStatus("reconnecting");
    return () => {
      es.close();
      setStreamStatus("disconnected");
    };
  }, [activeTask, authed, task?.runId]);
  const selectedNode = useMemo(
    () => task?.nodes.find((workflowNode) => workflowNode.id === selected),
    [task, selected],
  );
  const impactNodeIds = useMemo(() => {
    if (!task || !selected) return [];
    const edges = [...task.edges, ...extraEdges];
    const impacted = new Set<string>();
    const queue = [selected];
    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;
      edges
        .filter(([from]) => from === current)
        .forEach(([, target]) => {
          if (impacted.has(target)) return;
          impacted.add(target);
          queue.push(target);
        });
    }
    return [...impacted];
  }, [extraEdges, selected, task]);
  useEffect(() => {
    if (selectedResidue) {
      notify(`已选择残基 ${selectedResidue}，证据与代码上下文已关联`);
    }
  }, [selectedResidue]);
  useEffect(() => {
    if (!planOpen) return;
    const timer = window.setTimeout(() => {
      document
        .querySelector(".workflow-guide-target")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [planOpen]);
  const notify = (message: string) => setToast(message);
  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      const configResponse = await bioflowApi.saveConfig(config);
      setConfig(configResponse.config);
      const taskResponse = await bioflowApi.getTask(activeTask);
      setTask(taskResponse.task);
      if (taskResponse.tasks) setTaskList(taskResponse.tasks);
      setConfigOpen(false);
      notify("演示配置已应用");
    } catch (error) {
      notify(getApiErrorMessage(error, "配置保存失败，请检查服务状态"));
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
      router.push(`/projects/proj_a5211690a4/tasks/${activeTask}`);
    } else {
      router.push(next === "skills" ? "/skills" : "/files");
    }
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
    router.push(`/projects/proj_a5211690a4/tasks/${id}`);
    if (id === "task_demo_rnaseq") {
      setMobilePanel(false);
      notify("已切换到 RNA-seq 差异表达分析");
    } else if (nextTab) {
      openTool(nextTab);
      notify(`已打开${label}`);
    } else notify(`已切换到${label}`);
  };
  const createTask = async () => {
    const name = newTaskName.trim();
    if (!name) {
      notify("请先填写任务名称");
      return;
    }
    try {
      const response = await bioflowApi.createTask(name);
      setTaskList(response.tasks ?? []);
      const createdTask = response.task;
      setNewTaskName("");
      setModal(null);
      if (createdTask) {
        router.push(`/projects/proj_a5211690a4/tasks/${createdTask.id}`);
      }
      notify(`已创建任务：${name} · 已保存到服务端`);
    } catch (error) {
      notify(getApiErrorMessage(error, "新建任务失败，请稍后重试"));
    }
  };
  const profileUploadedFiles = async (files: File[]) => {
    const uploadFailures: string[] = [];
    setUploadError("");
    for (const file of files) {
      setUploadingFileName(file.name);
      try {
        const response = await bioflowApi.profileTabularFile(file, activeTask);
        setTask(response.task);
        setDataProfiles(response.task.dataProfiles ?? []);
        notify(`${file.name} 结构检查完成`);
      } catch (error) {
        const message = getApiErrorMessage(error, "文件结构解析失败");
        uploadFailures.push(`${file.name}：${message}`);
        notify(`${file.name} 解析失败`);
      } finally {
        setUploadingFileName("");
      }
    }
    setUploadError(uploadFailures.join("；"));
  };
  const applyDataProfile = (profile: DataFileProfile) => {
    const suggestedAnswers: ClarificationAnswers = {
      ...answers,
      format: profile.dataRole === "count_matrix" ? "Count 矩阵" : answers.format,
      comparison: profile.recognizedFields.condition ? "处理组 vs 对照组" : answers.comparison,
    };
    const nextUnansweredQuestion = clarificationQuestions.findIndex(
      (question) => !suggestedAnswers[question.key],
    );
    setAnswers(suggestedAnswers);
    setActiveQuestion(nextUnansweredQuestion >= 0 ? nextUnansweredQuestion : 3);
    setModal(null);
    notify(`已将 ${profile.fileName} 的结构建议应用到分析上下文`);
  };
  const submitClarifications = async () => {
    if (submittingAnswers || Object.values(answers).some((answer) => !answer)) return;
    setSubmittingAnswers(true);
    try {
      const response = await bioflowApi.submitClarifications(activeTask, { answers });
      if (task?.executionMode === "real") {
        const planResponse = await bioflowApi.generatePlan(activeTask, task.goal, answers);
        setTask(planResponse.task || response.task);
        notify("LLM 已生成分析计划，请检查证据和风险");
      } else setTask(response.task);
    } catch (error) {
      if (task?.executionMode === "real")
        setTask((current) => (current ? { ...current, status: "awaiting_approval" } : current));
      notify(getApiErrorMessage(error, "澄清信息提交失败，请检查服务状态"));
    } finally {
      setSubmittingAnswers(false);
    }
  };
  const approvePlan = async () => {
    if (approvingPlan) return;
    setApprovingPlan(true);
    try {
      const response = await bioflowApi.approvePlan(activeTask);
      setTask(response.task);
      notify("分析计划已批准，等待运行");
    } catch (error) {
      notify(getApiErrorMessage(error, "分析计划审批失败，请检查服务状态"));
    } finally {
      setApprovingPlan(false);
    }
  };
  const runDemo = async () => {
    if (task?.executionMode === "real") {
      document.getElementById("real-analysis")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (running) {
      notify("工作流正在运行，请稍候");
      return;
    }
    if (task?.status === "running") {
      notify("工作流正在运行，请稍候");
      return;
    }
    if (task?.status === "draft" || task?.status === "clarifying") {
      notify("请先完成四项分析信息");
      return;
    }
    if (task?.status === "awaiting_approval") {
      notify("请先批准分析计划");
      return;
    }
    setRunning(true);
    setCodeText("");
    setCodeStreaming(false);
    notify("工作流已开始运行");
    try {
      await bioflowApi.startRun(activeTask);
    } catch (error) {
      setRunning(false);
      notify(getApiErrorMessage(error, "启动失败，请检查服务状态"));
      return;
    }
  };
  const retry = async () => {
    setRetrying(true);
    setCodeText("");
    try {
      if (!task?.runId) throw new Error("当前任务没有可重试的运行");
      await bioflowApi.retryNode(task.runId, "design");
      setTimeout(() => setRetrying(false), 1300);
    } catch (error) {
      setRetrying(false);
      notify(getApiErrorMessage(error, "节点重试失败，请检查服务状态"));
    }
  };
  const sendMessage = () => {
    const text = messageText.trim();
    if (!text) {
      notify("请输入问题后再发送");
      return;
    }
    const createdAt = new Date().toISOString();
    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;
    setConversationMessages((items) => [
      ...items,
      {
        id: userMessageId,
        role: "user",
        content: text,
        createdAt,
        status: "completed",
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: `已收到。我会按 **${agentMode}** 检查项目文件，检索相关证据并绑定到可审批的分析参数。`,
        createdAt,
        status: "sending",
      },
    ]);
    setMessageText("");
    void bioflowApi
      .runRagQuery(text, activeTask)
      .then((response) => {
        const citations = response.trace.rerankedResults
          .filter((item) => item.kept)
          .slice(0, 3)
          .map((item, index) => ({
            id: item.chunkId,
            label: `证据 ${index + 1}`,
            detail: response.trace.chunks.find((chunk) => chunk.id === item.chunkId)?.text,
          }));
        setConversationMessages((items) =>
          items.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  status: "completed",
                  traceId: response.trace.id,
                  citations,
                  content:
                    response.trace.indexSummary?.provider === "qdrant"
                      ? `${response.trace.finalDecision.summary}${citations.length ? " [1]" : ""}`
                      : `演示建议：${response.trace.finalDecision.summary} [1][2]`,
                }
              : message,
          ),
        );
        setSelectedEvidenceId(citations[0]?.id || null);
        setRagTrace(response.trace);
        setTab("evidence");
        setMobilePanel(true);
        notify("RAG 全链路已完成，可展开查看 Top 20 召回与参数依据");
      })
      .catch((error) => {
        setConversationMessages((items) =>
          items.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  status: "failed",
                  content: getApiErrorMessage(error, "RAG 检索失败，请稍后重试"),
                }
              : message,
          ),
        );
        notify(getApiErrorMessage(error, "RAG 检索失败，请稍后重试"));
      });
  };
  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      notify("消息已复制");
    } catch {
      notify("当前浏览器不允许读取剪贴板");
    }
  };
  const retryMessage = (content: string) => {
    setMessageText(content);
    notify("已恢复问题，请确认后重新发送");
  };
  const openTraceForMessage = async (traceId?: string) => {
    if (traceId && traceId !== ragTrace?.id) {
      try {
        const response = await bioflowApi.getRagTrace(traceId);
        setRagTrace(response.trace);
      } catch (error) {
        notify(getApiErrorMessage(error, "Trace 加载失败，请稍后重试"));
        return;
      }
    }
    setTab("evidence");
    setMobilePanel(true);
  };
  const selectCitation = (citationId: string, traceId?: string) => {
    setSelectedEvidenceId(citationId);
    void openTraceForMessage(traceId);
  };
  const cancel = async () => {
    if (cancellingRun) return;
    setCancellingRun(true);
    try {
      if (!task?.runId) throw new Error("当前任务没有正在运行的作业");
      await bioflowApi.cancelRun(task.runId);
      const taskResponse = await bioflowApi.getTask(activeTask);
      setTask(taskResponse.task);
      setRunning(false);
      setCodeStreaming(false);
      notify("运行已取消");
    } catch (error) {
      notify(getApiErrorMessage(error, "取消失败，请稍后重试"));
    } finally {
      setCancellingRun(false);
    }
  };
  const startResize = (kind: "sidebar" | "inspector" | "evidence", event: React.PointerEvent) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(kind);
    const startX = event.clientX,
      startY = event.clientY,
      base =
        kind === "sidebar" ? sidebarWidth : kind === "inspector" ? inspectorWidth : evidenceHeight;
    const move = (e: PointerEvent) => {
      if (kind === "sidebar") {
        setSidebarWidth(Math.min(390, Math.max(210, base + e.clientX - startX)));
      }
      if (kind === "inspector") {
        setInspectorWidth(Math.min(520, Math.max(260, base + startX - e.clientX)));
      }
      if (kind === "evidence") {
        setEvidenceHeight(Math.min(220, Math.max(70, base + e.clientY - startY)));
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
  const clampZoom = (value: number) => Math.min(1.6, Math.max(0.55, value));
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
  const startNodeDrag = (node: WorkflowNodeState, event: React.PointerEvent<HTMLButtonElement>) => {
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
  const createLayoutVersion = async () => {
    if (creatingLayoutVersion || !layoutReady) return;
    setCreatingLayoutVersion(true);
    setLayoutSaveState("saving");
    try {
      const versionName = `分析布局 v1.${layoutVersionCount + 1}`;
      const response = await bioflowApi.createWorkflowLayoutVersion(
        versionName,
        workflowLayoutInput,
        activeTask,
      );
      lastSavedLayoutRef.current = serializedWorkflowLayout;
      setLayoutRevision(response.layout.current.revision);
      setLayoutVersionCount(response.layout.versions.length);
      setLayoutSaveState("saved");
      notify(`已保存 ${response.version.name}`);
    } catch (error) {
      setLayoutSaveState("error");
      notify(getApiErrorMessage(error, "布局版本保存失败，请稍后重试"));
    } finally {
      setCreatingLayoutVersion(false);
    }
  };
  const resetCanvas = () => {
    setCanvasZoom(1);
    setCanvasPan({ x: 0, y: 0 });
    setNodePositions({});
    setExtraEdges([]);
    setConnectingFrom(null);
    notify("画布位置和缩放已重置");
  };
  if (!authed || !task) {
    return (
      <main className="boot">
        {!skipBoot && <ParticleLoader onSkip={() => setSkipBoot(true)} />}
        <div className="boot-content">
          <div className="boot-mark">⦿</div>
          {initializationError ? (
            <>
              <p>工作区连接失败</p>
              <small>{initializationError}</small>
              <button
                className="boot-retry"
                onClick={() => {
                  setInitializationError("");
                  setSkipBoot(false);
                  setBootAttempt((attempt) => attempt + 1);
                }}
              >
                重新连接
              </button>
            </>
          ) : (
            <>
              <p>{skipBoot ? "正在进入安全科研工作区…" : "正在初始化安全科研工作区…"}</p>
              <small>正在连接任务状态 · 加载证据索引 · 可随时跳过动画</small>
            </>
          )}
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
          data-guide="files-nav"
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
        taskList={taskList}
        uploadedFileNames={uploadedFiles}
        dataProfiles={dataProfiles}
        statusLabels={statusLabel}
        onOpenProjectPicker={() => setModal({ kind: "projects", title: "切换项目" })}
        onCreateTask={() => setModal({ kind: "new-task", title: "新建科研任务" })}
        onSelectTask={selectTask}
        onUploadFile={() => {
          setUploadError("");
          setModal({ kind: "upload", title: "上传项目文件" });
        }}
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
              <i /> 智能体 · {statusLabel[task.status] || task.status}
            </span>
            <button onClick={shareTask}>分享</button>
            <button onClick={() => setModal({ kind: "layout", title: "工作区布局" })}>布局</button>
            <button onClick={() => setDocsOpen(true)}>文档</button>
            <button onClick={() => setGuideOpen(true)}>使用指引</button>
          </div>
        </header>
        <div className="goal-strip" data-guide="goal">
          <div>
            <small>当前研究目标 · {task.executionMode === "real" ? "真实服务" : "演示数据"}</small>
            <h1>{task.goal}</h1>
          </div>
          <div className="goal-actions">
            <span className={`status-pill ${task.status}`}>
              ● {statusLabel[task.status] || task.status}
            </span>
            {task.executionMode !== "real" && (
              <button className="secondary" onClick={() => setConfigOpen(true)}>
                配置
              </button>
            )}
            <button className="secondary" onClick={() => setPlanOpen((current) => !current)}>
              {planOpen ? "收起工作流" : "查看工作流"}
            </button>
            <button className="secondary" onClick={() => setMobilePanel(!mobilePanel)}>
              工具
            </button>
            {task.status === "running" && task.executionMode !== "real" && (
              <button className="secondary danger" onClick={cancel} disabled={cancellingRun}>
                {cancellingRun ? "取消中…" : "取消"}
              </button>
            )}
            <button
              className="primary"
              data-guide="run"
              onClick={
                task.executionMode === "real"
                  ? () =>
                      document
                        .getElementById("real-analysis")
                        ?.scrollIntoView({ behavior: "smooth" })
                  : runDemo
              }
            >
              {task.executionMode === "real" ? "分析运行" : running ? "运行中…" : "运行工作流"}
            </button>
          </div>
        </div>
        <div className="dialogue-thread">
          <div className="user-message">
            <small>你 · 刚刚</small>
            <p>{task.goal}</p>
          </div>
          <div className="agent-message">
            <div className="assistant-avatar">✦</div>
            <div>
              <small>BioFlow 智能体</small>
              <p>
                可以。我会先检查项目文件，再确认数据格式、实验设计和交付要求，然后生成一份可审批的分析计划。
              </p>
              <button className="trace-chip" onClick={() => setTraceOpen((current) => !current)}>
                {traceOpen
                  ? "收起执行轨迹"
                  : task.executionMode === "real"
                    ? "查看文件与检索状态"
                    : "演示执行轨迹"}
              </button>
            </div>
          </div>
        </div>
        <div
          data-guide="evidence"
          className={`evidence-strip ${traceOpen ? "" : "trace-collapsed"}`}
          style={{ height: evidenceHeight }}
        >
          <div className="evidence-label">
            <span>✦</span>
            <b>证据流水线</b>
            <small>智能体决策追踪</small>
          </div>
          {events.map((timelineEvent) => (
            <button
              key={timelineEvent.id}
              className={`evidence-step ${timelineEvent.state}`}
              onClick={() => openTool("evidence")}
            >
              <span className="phase">{timelineEvent.phase}</span>
              <span>
                <b>{timelineEvent.title}</b>
                <small>{timelineEvent.detail}</small>
              </span>
              <em>{timelineEvent.time}</em>
            </button>
          ))}
          <div
            className="horizontal-splitter"
            onPointerDown={(pointerEvent) => startResize("evidence", pointerEvent)}
            title="拖拽调整证据区高度"
          />
        </div>
        {(task?.status === "clarifying" || task?.status === "draft") && (
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
            onUseDemoData={() => {
              if (task.executionMode === "real") {
                void fetch(`/api/tasks/${activeTask}/analysis`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "samples" }),
                })
                  .then(async (res) => {
                    const body = await res.json();
                    if (!res.ok) throw new Error(body.error);
                    setTask((current) =>
                      current?.id === activeTask
                        ? { ...current, fileIds: body.task.fileIds }
                        : current,
                    );
                  })
                  .catch((error) => notify(error.message));
              }
              setAnswers({
                format: "Count 矩阵",
                comparison: "处理组 vs 对照组",
                organism: "人类",
                deliverable: "可发表结果",
              });
              setActiveQuestion(3);
              notify("已载入示例 RNA-seq 上下文，请检查后生成计划");
            }}
          />
        )}
        {task?.status === "awaiting_approval" && (
          <div className="gate-card approval">
            <div className="gate-head">
              <div>
                <small>分析计划待确认</small>
                <h2>{task.plan?.title || task.skill?.name || task.title}</h2>
                <p>
                  {task.executionMode === "real"
                    ? `${task.plan?.provider === "llm" ? `LLM · ${task.plan.model}` : "等待 LLM 计划"} · 已绑定 ${task.fileIds?.length || 0} 份输入文件 · 本机分析`
                    : "演示工作流 · 6 步"}
                </p>
              </div>
              <span className="status-pill blocked">等待审批</span>
            </div>
            <div className="plan-preview">
              {(
                task.plan?.steps || [
                  { id: "01", title: "校验数据结构" },
                  { id: "02", title: "构建设计矩阵" },
                  { id: "03", title: "执行 DESeq2" },
                  { id: "04", title: "生成火山图" },
                  { id: "05", title: "排序候选基因" },
                  { id: "06", title: "撰写科研报告" },
                ]
              ).map((step) => (
                <span key={step.id}>
                  {step.id} {step.title}
                </span>
              ))}
            </div>
            {task.plan?.risks?.length ? (
              <p className="plan-risks">风险：{task.plan.risks.join("；")}</p>
            ) : null}
            <div className="approval-actions">
              <button className="secondary" onClick={() => openTool("evidence")}>
                查看证据
              </button>
              <button
                className="primary"
                onClick={approvePlan}
                disabled={approvingPlan || (task.executionMode === "real" && !task.plan)}
              >
                {approvingPlan ? "审批中…" : "批准计划"}
              </button>
            </div>
          </div>
        )}
        <div className={`workflow-guide-target ${planOpen ? "workflow-open" : ""}`}>
          <WorkflowCanvas
            open={planOpen}
            nodes={task.nodes}
            edges={task.edges}
            extraEdges={extraEdges}
            selected={selected}
            impactNodeIds={impactNodeIds}
            connectingFrom={connectingFrom}
            canvasZoom={canvasZoom}
            canvasPan={canvasPan}
            nodePositions={nodePositions}
            layoutRevision={layoutRevision}
            layoutVersionCount={layoutVersionCount}
            layoutSaveState={layoutSaveState}
            creatingVersion={creatingLayoutVersion}
            onZoomChange={(update) => setCanvasZoom((value) => clampZoom(update(value)))}
            onReset={resetCanvas}
            onCreateVersion={createLayoutVersion}
            onCanvasPanStart={startCanvasPan}
            onCanvasWheel={(event) => {
              event.preventDefault();
              setCanvasZoom((value) => clampZoom(value + (event.deltaY < 0 ? 0.08 : -0.08)));
            }}
            onNodePointerDown={startNodeDrag}
          />
        </div>
        {task.executionMode === "real" && (
          <RealAnalysisPanel key={task.id} task={task} onTaskChange={setTask} />
        )}
        <ConversationPanel
          messages={conversationMessages}
          taskStatus={task.status}
          messageText={messageText}
          agentMode={agentMode}
          onMessageTextChange={setMessageText}
          onSendMessage={sendMessage}
          onAddFile={() => setModal({ kind: "upload", title: "添加项目文件" })}
          onAgentModeChange={() => {
            const nextMode =
              agentMode === "标准模式"
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
          onCopyMessage={(content) => void copyMessage(content)}
          onRetryMessage={retryMessage}
          onOpenTrace={openTraceForMessage}
          onCitationClick={selectCitation}
          onFeedback={(messageId, feedback) => {
            setConversationMessages((items) =>
              items.map((message) =>
                message.id === messageId ? { ...message, feedback } : message,
              ),
            );
            notify(feedback === "up" ? "已记录为有帮助" : "已记录改进反馈");
          }}
          onFollowUp={(question) => {
            setMessageText(question);
            notify("已填入后续问题，请确认后发送");
          }}
        />
      </section>
      <nav className="tool-dock" aria-label="研究工具">
        {[
          ["todo", "待办", "☷"],
          ["results", "结果", "▧"],
          ["compute", "计算", "◉"],
          ["notes", "笔记", "✎"],
          ["docs", "文档", "▤"],
        ].map(([key, label, icon]) => (
          <button
            key={key}
            className={tab === key && mobilePanel ? "active" : ""}
            onClick={() => {
              if (key === "docs") {
                setDocsOpen(true);
                return;
              }
              if (task.executionMode === "real" && (key === "results" || key === "compute")) {
                document.getElementById("real-analysis")?.scrollIntoView({ behavior: "smooth" });
                return;
              }
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
        selectedNode={selectedNode}
        workflowNodes={task.nodes}
        workflowEdges={[...task.edges, ...extraEdges]}
        statusLabels={statusLabel}
        answers={answers}
        liveLogs={liveLogs}
        streamStatus={streamStatus}
        sampleCount={
          dataProfiles.find((profile) => profile.dataRole === "count_matrix")?.sampleCount ||
          config.sampleCount
        }
        running={running}
        codeStreaming={codeStreaming}
        retrying={retrying}
        codeText={codeText}
        notes={notes}
        selectedResidue={selectedResidue}
        artifacts={task.artifacts}
        ragTrace={ragTrace}
        selectedChunkId={selectedEvidenceId}
        onTabChange={setTab}
        onNotesChange={setNotes}
        onClose={() => setMobilePanel(false)}
        onSelectQuestion={(questionIndex) => {
          setActiveQuestion(questionIndex);
          setMobilePanel(false);
          notify(`已定位到${clarificationQuestions[questionIndex].label}`);
        }}
        onOpenSource={(title, detail) => setModal({ kind: "source", title, detail })}
        onRetry={retry}
        onRunDemo={runDemo}
        onDownloadVolcano={downloadVolcano}
        onSelectResultSource={(nodeId) => {
          setSelected(nodeId);
          setTab("evidence");
          notify("已定位到结果血缘中的来源节点");
        }}
        onResidueSelect={setSelectedResidue}
        onOpenMolstar={() => notify("当前为轻量 3D 预览；接入 Mol* 后将在此打开完整结构查看器")}
        onDownloadReport={downloadReport}
        onNotify={notify}
        onResizeStart={(event) => startResize("inspector", event)}
        onCopy={(value) => {
          void navigator.clipboard.writeText(value);
          notify("审计 JSON 已复制");
        }}
      />
      {modal && (
        <WorkspaceModal
          modal={modal}
          projectName={projectName}
          dataProfiles={dataProfiles}
          uploadingFileName={uploadingFileName}
          uploadError={uploadError}
          newTaskName={newTaskName}
          onClose={() => setModal(null)}
          onSelectProject={(nextProjectName) => {
            setProjectName(nextProjectName);
            setModal(null);
            notify(`已切换到${nextProjectName}`);
          }}
          onOpenFile={(fileName, detail) => setModal({ kind: "file", title: fileName, detail })}
          onNewTaskNameChange={setNewTaskName}
          onCreateTask={createTask}
          onUploadFiles={profileUploadedFiles}
          onApplyDataProfile={applyDataProfile}
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
      <ProductGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
      <DocumentationDrawer
        open={docsOpen}
        activeTaskId={activeTask}
        onClose={() => setDocsOpen(false)}
      />
      <button className="mobile-inspector-trigger" onClick={() => setMobilePanel(true)}>
        检查器 · {selectedNode?.label}
      </button>
    </main>
  );
}
