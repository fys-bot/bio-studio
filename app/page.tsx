"use client";
import BiotechRounded from "@mui/icons-material/BiotechRounded";
import DashboardCustomizeRounded from "@mui/icons-material/DashboardCustomizeRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import ExtensionRounded from "@mui/icons-material/ExtensionRounded";
import FolderOutlined from "@mui/icons-material/FolderOutlined";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import InputRounded from "@mui/icons-material/InputRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import MenuBookRounded from "@mui/icons-material/MenuBookRounded";
import ShareOutlined from "@mui/icons-material/ShareOutlined";
import StreamRounded from "@mui/icons-material/StreamRounded";
import HubOutlined from "@mui/icons-material/HubOutlined";
import ViewInArOutlined from "@mui/icons-material/ViewInArOutlined";
import ViewQuiltRounded from "@mui/icons-material/ViewQuiltRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import AccountTreeRounded from "@mui/icons-material/AccountTreeRounded";
import BuildOutlined from "@mui/icons-material/BuildOutlined";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import { Button } from "@mui/material";
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
import { ContentLoading } from "@/components/ContentLoading";
import { WorkspaceToolDock } from "@/components/WorkspaceToolDock";
import { FilePreview } from "@/components/FilePreview";
import { useAuthSession } from "@/components/auth/AuthSessionGate";
import {
  RunStreamTrace,
  type RunStreamEvent,
  type StreamStatus,
} from "@/components/RunStreamTrace";
import { defaultDemoConfig, type DemoConfig } from "@/lib/demo-config";
import { DEFAULT_AGENT_MODE, type AgentMode } from "@/lib/agent-mode";
import {
  ApiClientError,
  authorizedFetch,
  bioflowApi,
  getApiErrorMessage,
  readAuthorizedSse,
} from "@/lib/api-client";
import type {
  ConversationMessage,
  DataFileProfile,
  RagTrace,
  ResearchTask,
  TaskListItem,
  WorkflowNodeState,
} from "@/lib/domain";
import { roleLabel } from "@/lib/access-control";
import type { WorkspaceProject } from "@/lib/project-store";
type WarmWorkspaceSnapshot = {
  task: ResearchTask;
  taskList: TaskListItem[];
  dataProfiles: DataFileProfile[];
};

// 仅在当前 SPA 会话内保留最近工作区，硬刷新仍展示完整首载动画。
let warmWorkspaceSnapshot: WarmWorkspaceSnapshot | null = null;

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

const clampCanvasZoom = (value: number) => Math.min(1.6, Math.max(0.5, value));

function appendStreamEvent(current: RunStreamEvent[], next: RunStreamEvent) {
  if (next.type === "plan.waiting") {
    const existingIndex = current.findIndex(
      (event) =>
        event.runId === next.runId &&
        event.type === next.type &&
        event.payload.stage === next.payload.stage,
    );
    if (existingIndex < 0) return [...current, next].slice(-160);
    const updated = [...current];
    updated[existingIndex] = next;
    return updated;
  }
  if (next.type !== "code.delta") return [...current, next].slice(-160);
  const existingIndex = current.findIndex(
    (event) => event.runId === next.runId && event.type === "code.delta",
  );
  if (existingIndex < 0) return [...current, next].slice(-160);
  const existing = current[existingIndex];
  const updated = [...current];
  updated[existingIndex] = {
    ...existing,
    id: next.id,
    createdAt: next.createdAt,
    payload: {
      ...existing.payload,
      ...next.payload,
      text: `${typeof existing.payload.text === "string" ? existing.payload.text : ""}${typeof next.payload.text === "string" ? next.payload.text : ""}`,
    },
  };
  return updated;
}

let clientEventSequence = 0;
function createClientStreamEvent(
  taskId: string,
  type: string,
  payload: Record<string, unknown>,
  runId = `client:${taskId}`,
): RunStreamEvent {
  clientEventSequence += 1;
  return {
    id: Date.now() * 100 + clientEventSequence,
    runId,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
}

function getCanvasViewportSize(viewportWidth: number, sidebarWidth: number) {
  if (viewportWidth <= 760) {
    return { width: Math.max(300, viewportWidth - 30), height: 300 };
  }
  const railWidth = viewportWidth <= 1500 ? 58 : 68;
  const visibleSidebarWidth = viewportWidth <= 1200 ? 190 : Math.min(sidebarWidth, 220);
  return {
    width: Math.max(360, viewportWidth - railWidth - visibleSidebarWidth - 128),
    height: 370,
  };
}

function getWorkflowBounds(
  nodes: WorkflowNodeState[],
  nodePositions: Record<string, { x: number; y: number }>,
) {
  const positions = nodes.map((node) => nodePositions[node.id] || node);
  const minimumX = Math.min(...positions.map((position) => position.x));
  const minimumY = Math.min(...positions.map((position) => position.y));
  const maximumX = Math.max(...positions.map((position) => position.x + 170));
  const maximumY = Math.max(...positions.map((position) => position.y + 104));
  return {
    minimumX,
    minimumY,
    width: Math.max(170, maximumX - minimumX),
    height: Math.max(104, maximumY - minimumY),
  };
}

function fitWorkflowCanvas(
  nodes: WorkflowNodeState[],
  nodePositions: Record<string, { x: number; y: number }>,
  viewportWidth: number,
  sidebarWidth: number,
) {
  if (!nodes.length) return { zoom: 1, pan: { x: 0, y: 0 } };
  const viewport = getCanvasViewportSize(viewportWidth, sidebarWidth);
  const bounds = getWorkflowBounds(nodes, nodePositions);
  const zoom = clampCanvasZoom(
    Math.min(1, (viewport.width - 24) / bounds.width, (viewport.height - 24) / bounds.height),
  );
  const scaledWidth = bounds.width * zoom;
  const scaledHeight = bounds.height * zoom;
  return {
    zoom,
    pan: {
      x: Math.max(12, (viewport.width - scaledWidth) / 2) - bounds.minimumX * zoom,
      y: Math.max(12, (viewport.height - scaledHeight) / 2) - bounds.minimumY * zoom,
    },
  };
}

function normalizeRestoredCanvas(
  nodes: WorkflowNodeState[],
  nodePositions: Record<string, { x: number; y: number }>,
  zoom: number,
  pan: { x: number; y: number },
  viewportWidth: number,
  sidebarWidth: number,
) {
  if (!nodes.length) return { zoom: clampCanvasZoom(zoom), pan };
  const viewport = getCanvasViewportSize(viewportWidth, sidebarWidth);
  const bounds = getWorkflowBounds(nodes, nodePositions);
  const responsiveMaximum = viewportWidth <= 760 ? 0.9 : viewportWidth <= 1200 ? 1 : 1.25;
  const fitZoom = Math.min(
    1,
    (viewport.width - 24) / bounds.width,
    (viewport.height - 24) / bounds.height,
  );
  const safeZoom = clampCanvasZoom(Math.min(zoom, responsiveMaximum, fitZoom));
  const minimumPanX = 12 - bounds.minimumX * safeZoom;
  const maximumPanX = viewport.width - 12 - (bounds.minimumX + bounds.width) * safeZoom;
  const minimumPanY = 12 - bounds.minimumY * safeZoom;
  const maximumPanY = viewport.height - 12 - (bounds.minimumY + bounds.height) * safeZoom;
  const clampPan = (value: number, minimum: number, maximum: number) =>
    maximum < minimum ? minimum : Math.min(maximum, Math.max(minimum, value));
  return {
    zoom: safeZoom,
    pan: {
      x: clampPan(pan.x, minimumPanX, maximumPanX),
      y: clampPan(pan.y, minimumPanY, maximumPanY),
    },
  };
}

/** BioFlow Studio 主工作台，负责领域状态编排，不承载具体工具视图实现。 */
export default function Home() {
  const router = useRouter();
  const { user } = useAuthSession();
  const params = useParams<{ taskId?: string }>();
  const pathname = usePathname();
  const routeTaskId = params?.taskId || "task_demo_rnaseq";
  const [authed, setAuthed] = useState(() => Boolean(warmWorkspaceSnapshot));
  const [task, setTask] = useState<ResearchTask | null>(() => warmWorkspaceSnapshot?.task ?? null);
  const [streamEvents, setStreamEvents] = useState<RunStreamEvent[]>([]);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [selected, setSelected] = useState("design");
  const [tab, setTab] = useState<InspectorTab>("todo");
  const [mobilePanel, setMobilePanel] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [notes, setNotes] = useState("");
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
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
  const [resizing, setResizing] = useState<"sidebar" | "inspector" | null>(null);
  const [selectedResidue, setSelectedResidue] = useState<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [planOpen, setPlanOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [extraEdges, setExtraEdges] = useState<string[][]>([]);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [canvasPanning, setCanvasPanning] = useState(false);
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
  const [activeProjectId, setActiveProjectId] = useState("proj_a5211690a4");
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [modal, setModal] = useState<WorkspaceModalState | null>(null);
  const [previewFileId, setPreviewFileId] = useState("");
  const [toast, setToast] = useState("");
  const [agentMode, setAgentMode] = useState<AgentMode>(DEFAULT_AGENT_MODE);
  const [taskList, setTaskList] = useState<TaskListItem[]>(
    () => warmWorkspaceSnapshot?.taskList ?? [],
  );
  const [dataProfiles, setDataProfiles] = useState<DataFileProfile[]>(
    () => warmWorkspaceSnapshot?.dataProfiles ?? [],
  );
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [newTaskName, setNewTaskName] = useState("");
  const [config, setConfig] = useState<DemoConfig>(defaultDemoConfig);
  const [configOpen, setConfigOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [initializationError, setInitializationError] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskLoadError, setTaskLoadError] = useState("");
  const [workspaceScrolled, setWorkspaceScrolled] = useState(false);
  const [ragTrace, setRagTrace] = useState<RagTrace | null>(null);
  const guideInitializedRef = useRef(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const receivedStreamEventIdsRef = useRef<Set<string>>(new Set());
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
    setTaskLoading(true);
    setTaskLoadError("");
    setConversationMessages([]);
    setNotes("");
    setAnswers({ format: "", comparison: "", organism: "", deliverable: "" });
    conversationHydratedRef.current = false;
    notesHydratedRef.current = false;
    setStreamEvents([]);
    receivedStreamEventIdsRef.current.clear();
    setRagTrace(null);
    setSelectedEvidenceId(null);
    setRunning(false);
    setCodeText("");
    setCodeStreaming(false);
    setLiveLogs([]);
    setStreamStatus("idle");
    setProfileMenuOpen(false);
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
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeAccountMenu = (event: PointerEvent) => {
      if (guideOpen) return;
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeAccountMenu);
    return () => document.removeEventListener("pointerdown", closeAccountMenu);
  }, [guideOpen, profileMenuOpen]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!authed || !task || guideInitializedRef.current) return;
    guideInitializedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.has("docs")) {
      setGuideOpen(false);
      setDocsOpen(true);
      return;
    }
    if (params.has("guide") || !window.localStorage.getItem("bioflow-studio-guide-v2")) {
      setGuideOpen(true);
    }
  }, [authed, task]);
  useEffect(() => {
    if (!authed || !task) return;
    warmWorkspaceSnapshot = { task, taskList, dataProfiles };
  }, [authed, dataProfiles, task, taskList]);
  useEffect(() => {
    if (!authed) return;
    void bioflowApi
      .listProjects()
      .then((response) => {
        setProjects(response.projects);
        const current = response.projects.find((project) => project.id === activeProjectId);
        if (current) setProjectName(current.name);
      })
      .catch(() => undefined);
  }, [activeProjectId, authed]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setInitializationError("");
        setTaskLoadError("");
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
        const restoredViewport = normalizeRestoredCanvas(
          taskResponse.task.nodes,
          restoredLayout.nodePositions,
          restoredLayout.zoom,
          restoredLayout.pan,
          window.innerWidth,
          sidebarWidth,
        );
        const restoredLayoutInput = {
          nodePositions: restoredLayout.nodePositions,
          extraEdges: restoredLayout.extraEdges,
          zoom: restoredViewport.zoom,
          pan: restoredViewport.pan,
        };
        setNodePositions(restoredLayout.nodePositions);
        setExtraEdges(restoredLayout.extraEdges);
        setCanvasZoom(restoredViewport.zoom);
        setCanvasPan(restoredViewport.pan);
        setLayoutRevision(restoredLayout.revision);
        setLayoutVersionCount(layoutResponse.layout.versions.length);
        lastSavedLayoutRef.current = JSON.stringify(restoredLayoutInput);
        setLayoutReady(true);
        setLayoutSaveState("saved");
        setAuthed(true);
        setTaskLoading(false);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "工作区初始化失败，请检查服务状态";
        if (task) setTaskLoadError(message);
        else setInitializationError(message);
        setTaskLoading(false);
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
    if (!authed || !task?.runId) {
      return;
    }
    const runId = task.runId;
    const sync = () =>
      bioflowApi
        .getTask(activeTask)
        .then((response) => {
          setTask(response.task);
          if (response.tasks) setTaskList(response.tasks);
        })
        .catch(() => undefined);
    const abortController = new AbortController();
    let stopped = false;
    let lastEventId = 0;
    const handleEvent = (runEvent: RunStreamEvent) => {
      try {
        const eventKey = `${runEvent.runId}:${runEvent.id}`;
        if (receivedStreamEventIdsRef.current.has(eventKey)) return;
        receivedStreamEventIdsRef.current.add(eventKey);
        lastEventId = Math.max(lastEventId, runEvent.id);
        setStreamEvents((events) => appendStreamEvent(events, runEvent));
        setLiveLogs((logs) =>
          [
            ...logs,
            `[${new Date(runEvent.createdAt).toLocaleTimeString()}] ${runEvent.type}${
              runEvent.nodeId ? ` · ${runEvent.nodeId}` : ""
            }`,
          ].slice(-100),
        );
        if (runEvent.type === "code.delta" && typeof runEvent.payload.text === "string") {
          const codeDelta = runEvent.payload.text;
          setCodeStreaming(true);
          setCodeText((currentCode) => currentCode + codeDelta);
        }
        if (runEvent.type === "rag.trace.created" && typeof runEvent.payload.traceId === "string") {
          void bioflowApi
            .getRagTrace(runEvent.payload.traceId)
            .then((response) => setRagTrace(response.trace))
            .catch(() => undefined);
        }
        if (runEvent.type === "code.completed") setCodeStreaming(false);
        if (
          ["run.started", "node.updated", "run.completed", "run.cancelled"].includes(runEvent.type)
        ) {
          void sync();
        }
        if (
          ["run.completed", "run.cancelled"].includes(runEvent.type) ||
          (runEvent.type === "node.updated" && runEvent.payload.status === "failed")
        ) {
          setRunning(false);
        }
        if (runEvent.type === "run.completed") setStreamStatus("completed");
        if (
          runEvent.type === "run.cancelled" ||
          (runEvent.type === "node.updated" && runEvent.payload.status === "failed")
        ) {
          setStreamStatus("failed");
        }
      } catch {}
    };
    const connect = async () => {
      while (!stopped && !abortController.signal.aborted) {
        try {
          await readAuthorizedSse<RunStreamEvent>(
            `/api/runs/${encodeURIComponent(runId)}/events?after=${lastEventId}`,
            {
              signal: abortController.signal,
              onOpen: () =>
                setStreamStatus((current) => (current === "failed" ? current : "connected")),
              onEvent: handleEvent,
            },
          );
        } catch {
          if (abortController.signal.aborted) return;
          setStreamStatus("reconnecting");
        }
        if (!stopped) await new Promise((resolve) => window.setTimeout(resolve, 800));
      }
    };
    void connect();
    return () => {
      stopped = true;
      abortController.abort();
      setStreamStatus("idle");
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
  const deleteTask = async (taskId: string, taskTitle: string) => {
    try {
      const response = await bioflowApi.deleteTask(taskId);
      setTaskList(response.tasks ?? []);
      if (activeTask === taskId) {
        router.replace("/projects/proj_a5211690a4/tasks/task_demo_rnaseq");
      }
      notify(`已删除任务：${taskTitle}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "NOT_FOUND") {
        const response = await bioflowApi.getTask("task_demo_rnaseq");
        setTaskList(response.tasks ?? []);
        if (activeTask === taskId) {
          router.replace("/projects/proj_a5211690a4/tasks/task_demo_rnaseq");
        }
        notify(`任务“${taskTitle}”已不存在，列表已刷新`);
        return;
      }
      notify(getApiErrorMessage(error, "删除任务失败"));
      throw error;
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
    setTraceOpen(true);
    setStreamEvents([]);
    setLiveLogs([]);
    receivedStreamEventIdsRef.current.clear();
    setStreamStatus("starting");
    try {
      const response = await bioflowApi.submitClarifications(activeTask, { answers });
      setTask(response.task);
      setStreamStatus("connecting");
      const planResponse = await bioflowApi.generatePlan(
        activeTask,
        task?.goal || response.task.goal,
        answers,
        [],
        {
          mode: agentMode,
          onEvent: (event) => {
            setStreamEvents((events) => appendStreamEvent(events, event));
            if (event.type !== "plan.waiting") {
              setLiveLogs((logs) =>
                [
                  ...logs,
                  `[${new Date(event.createdAt).toLocaleTimeString()}] ${event.type}`,
                ].slice(-100),
              );
            }
            if (event.type === "plan.completed") setStreamStatus("completed");
            else if (event.type === "plan.failed") setStreamStatus("failed");
            else setStreamStatus("connected");
          },
          onOpen: () => setStreamStatus("connected"),
        },
      );
      setTask(planResponse.task || response.task);
      notify("LLM 已生成分析计划，请检查证据和风险");
    } catch (error) {
      setStreamStatus("failed");
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
      setTraceOpen(true);
      setStreamStatus("blocked");
      setStreamEvents([
        createClientStreamEvent(activeTask, "client.run.blocked", {
          stage: "clarification",
          progress: Object.values(answers).filter(Boolean).length * 20,
          detail: `运行实例尚未创建，请先完成 ${4 - Object.values(answers).filter(Boolean).length} 项分析信息`,
        }),
      ]);
      const nextQuestion = clarificationQuestions.findIndex((question) => !answers[question.key]);
      if (nextQuestion >= 0) setActiveQuestion(nextQuestion);
      setTimeout(
        () => document.querySelector(".clarification-card")?.scrollIntoView({ behavior: "smooth" }),
        0,
      );
      notify("运行尚未开始：请先完成四项分析信息");
      return;
    }
    if (task?.status === "awaiting_approval") {
      setTraceOpen(true);
      setStreamStatus("blocked");
      setStreamEvents([
        createClientStreamEvent(activeTask, "client.approval.required", {
          stage: "approval",
          progress: 0,
          detail: task.plan
            ? "分析计划已生成，批准后才会创建运行实例"
            : "等待 LLM 分析计划生成完成",
        }),
      ]);
      setTimeout(
        () => document.querySelector(".gate-card.approval")?.scrollIntoView({ behavior: "smooth" }),
        0,
      );
      notify("运行尚未开始：请先批准分析计划");
      return;
    }
    setRunning(true);
    setTraceOpen(true);
    setStreamEvents([]);
    receivedStreamEventIdsRef.current.clear();
    setLiveLogs([]);
    setCodeText("");
    setCodeStreaming(false);
    setStreamStatus("starting");
    setStreamEvents([
      createClientStreamEvent(activeTask, "client.run.requested", {
        stage: "run-bootstrap",
        step: 1,
        totalSteps: 3,
        progress: 8,
        detail: "正在校验任务审批状态并准备运行上下文",
      }),
    ]);
    notify("工作流已开始运行");
    try {
      const response = await bioflowApi.startRun(activeTask);
      setStreamEvents((events) => [
        ...events,
        createClientStreamEvent(
          activeTask,
          "client.run.created",
          {
            stage: "run-bootstrap",
            step: 2,
            totalSteps: 3,
            progress: 18,
            detail: `运行实例 ${response.runId.slice(0, 8)} 已创建`,
          },
          response.runId,
        ),
        createClientStreamEvent(
          activeTask,
          "client.sse.connecting",
          {
            stage: "event-stream",
            step: 3,
            totalSteps: 3,
            progress: 26,
            detail: "正在携带访问令牌连接运行事件流，并从首个事件开始订阅",
          },
          response.runId,
        ),
      ]);
      setStreamStatus("connecting");
      setTask((current) =>
        current ? { ...current, runId: response.runId, status: "running" } : current,
      );
    } catch (error) {
      setRunning(false);
      setStreamStatus("failed");
      notify(getApiErrorMessage(error, "启动失败，请检查服务状态"));
      return;
    }
  };
  const triggerPrimaryRun = () => {
    if (["draft", "clarifying", "awaiting_approval"].includes(task?.status || "")) {
      void runDemo();
      return;
    }
    if (task?.executionMode === "real") {
      document.getElementById("real-analysis")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    void runDemo();
  };
  const primaryRunLabel =
    task?.status === "draft" || task?.status === "clarifying"
      ? `先补充 ${Math.max(0, 4 - Object.values(answers).filter(Boolean).length)} 项`
      : task?.status === "awaiting_approval"
        ? "先批准计划"
        : task?.executionMode === "real"
          ? task.status === "running"
            ? "计算运行中"
            : "配置并运行"
          : running
            ? "运行中…"
            : "运行工作流";
  const retry = async () => {
    setRetrying(true);
    setCodeText("");
    setTraceOpen(true);
    setStreamStatus("connecting");
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
      .runRagQuery(text, activeTask, agentMode)
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
  const startResize = (kind: "sidebar" | "inspector", event: React.PointerEvent) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(kind);
    const startX = event.clientX,
      base = kind === "sidebar" ? sidebarWidth : inspectorWidth;
    const move = (e: PointerEvent) => {
      if (kind === "sidebar") {
        setSidebarWidth(Math.min(390, Math.max(210, base + e.clientX - startX)));
      }
      if (kind === "inspector") {
        setInspectorWidth(Math.min(520, Math.max(260, base + startX - e.clientX)));
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
  const startCanvasPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (target instanceof Element && target.closest("button, a, input, textarea, select, .node")) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setCanvasPanning(true);
    const start = { x: event.clientX, y: event.clientY },
      base = { ...canvasPan };
    const move = (e: PointerEvent) =>
      setCanvasPan({
        x: base.x + e.clientX - start.x,
        y: base.y + e.clientY - start.y,
      });
    const up = () => {
      setCanvasPanning(false);
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
    if (!task) return;
    const fittedLayout = fitWorkflowCanvas(task.nodes, nodePositions, viewportWidth, sidebarWidth);
    setCanvasZoom(fittedLayout.zoom);
    setCanvasPan(fittedLayout.pan);
    setExtraEdges([]);
    setConnectingFrom(null);
    notify("已适应当前工作流视图");
  };
  if (!authed || !task) {
    return (
      <main className="boot">
        <ParticleLoader />
        <div className="boot-content">
          <div className="boot-mark">BIOFLOW / EVIDENCE WORKSPACE</div>
          {initializationError ? (
            <>
              <p>工作区连接失败</p>
              <small>{initializationError}</small>
              <button
                className="boot-retry"
                onClick={() => {
                  setInitializationError("");
                  setBootAttempt((attempt) => attempt + 1);
                }}
              >
                重新连接
              </button>
            </>
          ) : (
            <>
              <p>正在初始化安全科研工作区…</p>
              <small>正在连接任务状态 · 加载证据索引 · 恢复工作流上下文</small>
            </>
          )}
        </div>
      </main>
    );
  }
  const taskIsStale = task.id !== routeTaskId;
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
        <div className="brand" aria-hidden="true">
          <BiotechRounded sx={{ fontSize: 24 }} />
        </div>
        <button
          className={`rail-btn ${activeNav === "workspace" ? "active" : ""}`}
          onClick={() => switchNav("workspace")}
        >
          <DashboardCustomizeRounded className="rail-icon" sx={{ fontSize: 19 }} />
          <span>工作台</span>
        </button>
        <button
          className={`rail-btn ${activeNav === "skills" ? "active" : ""}`}
          onClick={() => switchNav("skills")}
        >
          <ExtensionRounded className="rail-icon" sx={{ fontSize: 19 }} />
          <span>能力中心</span>
        </button>
        <button
          data-guide="files-nav"
          className={`rail-btn ${activeNav === "files" ? "active" : ""}`}
          onClick={() => switchNav("files")}
        >
          <FolderOutlined className="rail-icon" sx={{ fontSize: 19 }} />
          <span>文件</span>
        </button>
        {user?.permissions.includes("users:manage") && (
          <button className="rail-btn" onClick={() => router.push("/admin/users")}>
            <AdminPanelSettingsRounded className="rail-icon" sx={{ fontSize: 19 }} />
            <span>权限</span>
          </button>
        )}
        <div className="rail-spacer" />
        <div className="rail-account" ref={profileMenuRef}>
          <button
            className="avatar"
            data-guide="account-menu-trigger"
            onClick={() => setProfileMenuOpen((current) => !current)}
            aria-label="打开当前账户菜单"
            aria-expanded={profileMenuOpen}
          >
            <span className="avatar-initials">{user?.name.slice(0, 2).toUpperCase() || "我"}</span>
            <span className="avatar-label">我的</span>
          </button>
          {profileMenuOpen && (
            <div className="account-menu" role="menu">
              <div className="account-menu-profile">
                <b>{user?.name || "当前账户"}</b>
                <small>
                  {user
                    ? `${roleLabel(user.role)} · ${user.permissions.length} 项权限`
                    : "BioFlow 生命科学实验室"}
                </small>
              </div>
              {user?.permissions.includes("users:manage") && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    router.push("/admin/users");
                  }}
                >
                  <AdminPanelSettingsRounded sx={{ fontSize: 16 }} />
                  <span>
                    <b>用户与权限</b>
                    <small>新增账号并分配角色</small>
                  </span>
                </button>
              )}
              <div className="account-menu-showcases" data-guide="showcase-menu">
                <div className="account-menu-section-label">亮点实例</div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    selectTask("task_demo_rnaseq", "RNA-seq 真实计算");
                  }}
                >
                  <StreamRounded sx={{ fontSize: 16 }} />
                  <span>
                    <b>真实计算 + SSE</b>
                    <small>审批、流式事件、PyDESeq2</small>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    selectTask("task_literature", "文献证据图谱", "evidence");
                  }}
                >
                  <HubOutlined sx={{ fontSize: 16 }} />
                  <span>
                    <b>文档 RAG</b>
                    <small>解析、召回、证据追踪</small>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    selectTask("task_structure", "蛋白质结构预览", "structure");
                  }}
                >
                  <ViewInArOutlined sx={{ fontSize: 16 }} />
                  <span>
                    <b>3D 结构</b>
                    <small>旋转、缩放、残基联动</small>
                  </span>
                </button>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setModal({ kind: "layout", title: "工作区布局" });
                }}
              >
                <ViewQuiltRounded sx={{ fontSize: 16 }} />
                <span>
                  <b>工作区布局</b>
                  <small>调整面板与画布</small>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setDocsOpen(true);
                }}
              >
                <MenuBookRounded sx={{ fontSize: 16 }} />
                <span>
                  <b>开发文档</b>
                  <small>接口与前端接入说明</small>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setGuideOpen(true);
                }}
              >
                <HelpOutlineRounded sx={{ fontSize: 16 }} />
                <span>
                  <b>使用指引</b>
                  <small>从零开始完成工作流</small>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="account-menu-logout"
                onClick={() => {
                  setProfileMenuOpen(false);
                  void bioflowApi.logout().finally(() => router.push("/login"));
                }}
              >
                <LogoutRounded sx={{ fontSize: 16 }} />
                <span>
                  <b>退出登录</b>
                  <small>清除当前访问令牌</small>
                </span>
              </button>
            </div>
          )}
        </div>
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
        onDeleteTask={deleteTask}
        onUploadFile={() => {
          setUploadError("");
          setModal({ kind: "upload", title: "上传项目文件" });
        }}
        onOpenFile={(fileName, fileDetail, fileId) => {
          if (fileId) {
            setModal(null);
            setPreviewFileId(fileId);
            return;
          }
          setModal({ kind: "file", title: fileName, detail: fileDetail });
        }}
        onResizeStart={(event) => startResize("sidebar", event)}
      />
      <section
        className={`workspace ${workspaceScrolled ? "is-scrolled" : ""} ${taskLoading || taskIsStale ? "is-task-loading" : ""}`}
        onScroll={(event) => setWorkspaceScrolled(event.currentTarget.scrollTop > 86)}
      >
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
            <Button size="small" variant="text" startIcon={<ShareOutlined />} onClick={shareTask}>
              分享
            </Button>
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
              <Button
                className="secondary"
                variant="outlined"
                startIcon={<SettingsOutlined />}
                onClick={() => setConfigOpen(true)}
              >
                配置
              </Button>
            )}
            <Button
              className="secondary"
              variant="outlined"
              startIcon={<AccountTreeRounded />}
              onClick={() => setPlanOpen((current) => !current)}
            >
              {planOpen ? "收起工作流" : "查看工作流"}
            </Button>
            <Button
              className="secondary"
              variant="outlined"
              startIcon={<BuildOutlined />}
              onClick={() => setMobilePanel(!mobilePanel)}
            >
              工具
            </Button>
            {task.status === "running" && task.executionMode !== "real" && (
              <Button
                className="secondary danger"
                variant="outlined"
                color="error"
                onClick={cancel}
                disabled={cancellingRun}
              >
                {cancellingRun ? "取消中…" : "取消"}
              </Button>
            )}
            <Button
              className="primary"
              variant="contained"
              startIcon={<PlayArrowRounded />}
              data-guide="run"
              onClick={triggerPrimaryRun}
            >
              {primaryRunLabel}
            </Button>
          </div>
        </div>
        {(taskLoading || taskIsStale) && (
          <div className="content-loading-layer">
            <ContentLoading label={taskLoadError ? "任务切换失败" : "正在切换任务"} />
            {taskLoadError && (
              <div className="content-loading-error">
                <span>{taskLoadError}</span>
                <button onClick={() => setBootAttempt((attempt) => attempt + 1)}>重试</button>
              </div>
            )}
          </div>
        )}
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
              <RunStreamTrace
                events={streamEvents}
                open={traceOpen}
                streamStatus={streamStatus}
                onToggle={() => setTraceOpen((current) => !current)}
              />
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
                      void authorizedFetch(`/api/tasks/${activeTask}/analysis`, {
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
            </div>
          </div>
          <ConversationPanel
            messages={conversationMessages}
            taskStatus={task.status}
            messageText={messageText}
            agentMode={agentMode}
            onMessageTextChange={setMessageText}
            onSendMessage={sendMessage}
            onAddFile={() => setModal({ kind: "upload", title: "添加项目文件" })}
            onAgentModeChange={(nextMode) => {
              setAgentMode(nextMode);
              notify(`已切换为${nextMode}，后续请求会携带对应 reasoning effort`);
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
        </div>
        {task?.status === "awaiting_approval" && (
          <div className="gate-card approval">
            <div className="gate-head">
              <div>
                <small>分析计划待确认</small>
                <h2>{task.plan?.title || task.skill?.name || task.title}</h2>
                <p>
                  {task.executionMode === "real"
                    ? `${task.plan?.provider === "llm" ? `LLM · ${task.plan.model} · ${task.plan.mode || agentMode} / ${task.plan.reasoningEffort || "medium"}` : "等待 LLM 计划"} · 已绑定 ${task.fileIds?.length || 0} 份输入文件 · 本机分析`
                    : "演示工作流 · 6 步"}
                </p>
              </div>
              <span className="status-pill blocked">等待审批</span>
            </div>
            {task.plan?.summary && <p className="plan-summary">{task.plan.summary}</p>}
            <div className="plan-preview">
              {(
                task.plan?.steps || [
                  { id: "01", title: "校验数据结构", detail: "检查输入矩阵和样本字段" },
                  { id: "02", title: "构建设计矩阵", detail: "确认分组、对照和批次参数" },
                  { id: "03", title: "执行 DESeq2", detail: "运行差异表达统计模型" },
                  { id: "04", title: "生成火山图", detail: "输出显著性和效应量视图" },
                  { id: "05", title: "排序候选基因", detail: "按 FDR 与效应量筛选候选" },
                  { id: "06", title: "撰写科研报告", detail: "汇总方法、结果和可复现参数" },
                ]
              ).map((step) => (
                <details key={step.id}>
                  <summary>
                    <span>{step.id}</span>
                    <b>{step.title}</b>
                    <ExpandMoreRounded sx={{ fontSize: 15 }} aria-hidden="true" />
                  </summary>
                  <p>{step.detail}</p>
                </details>
              ))}
            </div>
            {(task.plan?.risks?.length || task.plan?.requiredInputs?.length) && (
              <div className="plan-context-grid">
                {task.plan.requiredInputs.length > 0 && (
                  <section>
                    <span>
                      <InputRounded sx={{ fontSize: 15 }} /> 必需输入
                    </span>
                    <p>{task.plan.requiredInputs.join("；")}</p>
                  </section>
                )}
                {task.plan.risks.length > 0 && (
                  <section>
                    <span>
                      <WarningAmberRounded sx={{ fontSize: 15 }} /> 运行前风险
                    </span>
                    <p>{task.plan.risks.join("；")}</p>
                  </section>
                )}
              </div>
            )}
            <div className="approval-actions">
              <button className="secondary" onClick={() => openTool("evidence")}>
                查看证据
              </button>
              <button
                className="primary"
                onClick={approvePlan}
                disabled={approvingPlan || !task.plan}
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
            canvasPanning={canvasPanning}
            nodePositions={nodePositions}
            layoutRevision={layoutRevision}
            layoutVersionCount={layoutVersionCount}
            layoutSaveState={layoutSaveState}
            creatingVersion={creatingLayoutVersion}
            onZoomChange={(update) => setCanvasZoom((value) => clampCanvasZoom(update(value)))}
            onReset={resetCanvas}
            onCreateVersion={createLayoutVersion}
            onCanvasPanStart={startCanvasPan}
            onCanvasWheel={(event) => {
              event.preventDefault();
              setCanvasZoom((value) => clampCanvasZoom(value + (event.deltaY < 0 ? 0.08 : -0.08)));
            }}
            onNodePointerDown={startNodeDrag}
          />
        </div>
        {task.executionMode === "real" && (
          <RealAnalysisPanel
            key={task.id}
            task={task}
            onTaskChange={setTask}
            onStreamConnect={(jobId) => {
              setTraceOpen(true);
              setStreamStatus("connecting");
              receivedStreamEventIdsRef.current.clear();
              setStreamEvents([
                createClientStreamEvent(
                  activeTask,
                  "client.sse.connecting",
                  {
                    stage: "analysis-event-stream",
                    progress: 2,
                    detail: "正在订阅真实 PyDESeq2 作业状态",
                  },
                  jobId,
                ),
              ]);
            }}
            onStreamEvent={(event) => {
              setStreamEvents((events) => appendStreamEvent(events, event));
              setLiveLogs((logs) =>
                [
                  ...logs,
                  `[${new Date(event.createdAt).toLocaleTimeString()}] ${event.type}`,
                ].slice(-100),
              );
            }}
            onStreamStatus={setStreamStatus}
          />
        )}
      </section>
      <WorkspaceToolDock
        activeTab={tab}
        inspectorOpen={mobilePanel}
        realExecution={task.executionMode === "real"}
        onOpenDocumentation={() => setDocsOpen(true)}
        onOpenRealAnalysis={() =>
          document.getElementById("real-analysis")?.scrollIntoView({ behavior: "smooth" })
        }
        onOpenInspector={(nextTab) => {
          setTab(nextTab);
          setMobilePanel(true);
        }}
      />
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
          projects={projects}
          activeProjectId={activeProjectId}
          projectName={projectName}
          dataProfiles={dataProfiles}
          uploadingFileName={uploadingFileName}
          uploadError={uploadError}
          newTaskName={newTaskName}
          onClose={() => setModal(null)}
          onSelectProject={(project) => {
            setActiveProjectId(project.id);
            setProjectName(project.name);
            setModal(null);
            notify(`已切换到${project.name}`);
          }}
          onCreateProject={async (name) => {
            const response = await bioflowApi.createProject(name);
            setProjects(response.projects);
            if (response.project) {
              setActiveProjectId(response.project.id);
              setProjectName(response.project.name);
              notify(`已新建并切换到${response.project.name}`);
            }
          }}
          onDeleteProject={async (project) => {
            const response = await bioflowApi.deleteProject(project.id);
            setProjects(response.projects);
            if (activeProjectId === project.id) {
              const fallback = response.projects[0];
              if (fallback) {
                setActiveProjectId(fallback.id);
                setProjectName(fallback.name);
              }
            }
            notify(`已删除${project.name}`);
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
      {previewFileId && <FilePreview fileId={previewFileId} onClose={() => setPreviewFileId("")} />}
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
      <ProductGuide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onShowcaseMenuChange={setProfileMenuOpen}
      />
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
