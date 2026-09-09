import type { DemoConfig } from "@/lib/demo-config";
import type {
  DataFileProfile,
  ResearchTask,
  TaskResponse,
  WorkflowLayoutState,
  WorkflowLayoutVersion,
  RagTrace,
  CatalogPage,
  ConversationMessage,
  ProjectFileRecord,
  SkillRecord,
} from "@/lib/domain";
import type { WorkflowLayoutInput } from "@/lib/workflow-layout";
import type { BioflowRole, BioflowSessionUser } from "@/lib/access-control";
import type { BioflowPermission } from "@/lib/access-control";
import type { WorkspaceProject } from "@/lib/project-store";
import { DEFAULT_AGENT_MODE, type AgentMode } from "@/lib/agent-mode";

type ApiErrorPayload = {
  error?: string;
};

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "SERVER"
  | "NETWORK";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryable: boolean;

  constructor(message: string, status: number, code: ApiErrorCode, retryable: boolean) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

/** 将 API 错误统一转换为可直接展示给研究人员的中文提示。 */
export function getApiErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

export type { BioflowRole } from "@/lib/access-control";

export type LoginResponse = {
  authenticated: boolean;
  accessToken: string;
  expiresAt: number;
  user: BioflowSessionUser;
};

export type RunResponse = {
  runId: string;
  task?: ResearchTask;
};

export type ConfigResponse = {
  config: DemoConfig;
};

export type ClarificationPayload = {
  answers: Record<string, string>;
};

export type FileProfileResponse = {
  profile: DataFileProfile;
  task: ResearchTask;
};

export type WorkflowLayoutResponse = {
  layout: WorkflowLayoutState;
};
export type ConversationResponse = { messages: ConversationMessage[] };
export type NotesResponse = { notes: string };
export type RagTraceResponse = {
  trace: RagTrace;
  answer?: { content: string; provider: "openai-compatible"; model: string };
};
export type SkillResponse = { skill: SkillRecord };
export type ProjectFileResponse = { file: ProjectFileRecord };
export type ManagedUser = BioflowSessionUser & {
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};
export type UsersResponse = { users: ManagedUser[]; user?: ManagedUser };
export type ProjectsResponse = { projects: WorkspaceProject[]; project?: WorkspaceProject };
export type DeleteTaskResponse = { deletedTaskId: string; tasks: TaskResponse["tasks"] };
export type DeleteFileResponse = {
  deletedFileId: string;
  deletedName: string;
  affectedTaskIds: string[];
};
export type DeleteSkillResponse = {
  deletedSkillId: string;
  disposition: "deleted" | "removed";
};
export type ApiStreamEvent = {
  id: number;
  runId: string;
  type: string;
  createdAt: string;
  nodeId?: string;
  payload: Record<string, unknown>;
};

type PlanStreamMessage = {
  event: ApiStreamEvent;
  result?: TaskResponse & { plan: NonNullable<ResearchTask["plan"]> };
  error?: string;
  code?: string;
};

/**
 * 前端 API 适配层：统一错误转换、JSON 解析和请求方法，页面不再直接拼接接口细节。
 */
const retryDelayMs = 180;
const ACCESS_TOKEN_KEY = "bioflow_access_token_v1";

export function getAccessToken() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

export function setAccessToken(token: string) {
  if (typeof window !== "undefined") window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

function withAuthorization(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const token = getAccessToken();
  if (token) nextHeaders.set("Authorization", `Bearer ${token}`);
  return nextHeaders;
}

export function authorizedFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    credentials: "omit",
    headers: withAuthorization(init?.headers),
  });
}

function reportGlobalApiError(error: ApiClientError) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("bioflow:api-error", { detail: { message: error.message } }),
  );
}

export async function downloadAuthorizedFile(path: string, fileName: string) {
  const response = await authorizedFetch(path);
  if (!response.ok)
    throw new ApiClientError(
      "文件下载失败",
      response.status,
      classifyStatus(response.status),
      response.status >= 500,
    );
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readAuthorizedSse<EventPayload>(
  path: string,
  options: {
    signal?: AbortSignal;
    request?: RequestInit;
    onOpen?: () => void;
    onEvent: (event: EventPayload, eventId?: string) => void;
  },
) {
  const headers = new Headers(options.request?.headers);
  headers.set("Accept", "text/event-stream");
  headers.set("Cache-Control", "no-cache");
  const response = await authorizedFetch(path, {
    ...options.request,
    signal: options.signal,
    headers,
  });
  if (!response.ok || !response.body) {
    throw new ApiClientError(
      response.status === 401 ? "登录状态已失效" : "事件流连接失败",
      response.status,
      classifyStatus(response.status),
      response.status >= 500,
    );
  }
  options.onOpen?.();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (!options.signal?.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const lines = block.split("\n");
      const eventId = lines
        .find((line) => line.startsWith("id:"))
        ?.slice(3)
        .trim();
      const data = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) options.onEvent(JSON.parse(data) as EventPayload, eventId);
      boundary = buffer.indexOf("\n\n");
    }
  }
}

const classifyStatus = (status: number): ApiErrorCode => {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status >= 400 && status < 500) return "VALIDATION";
  return "SERVER";
};

const toUserMessage = (code: ApiErrorCode, fallback: string) => {
  if (code === "UNAUTHORIZED")
    return fallback && fallback !== "Unauthorized" ? fallback : "登录状态已失效，请重新登录";
  if (code === "FORBIDDEN")
    return fallback && fallback !== "Forbidden" ? fallback : "当前操作没有权限";
  if (code === "NOT_FOUND") return "请求的演示资源不存在";
  if (code === "NETWORK") return "服务暂时不可用，请稍后重试";
  return fallback;
};

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs));

async function requestJson<ResponsePayload extends object>(
  path: string,
  init?: RequestInit,
): Promise<ResponsePayload> {
  const method = (init?.method || "GET").toUpperCase();
  const isFileCatalogRequest = method === "GET" && path === "/api/files";
  const maxAttempts = method === "GET" && !isFileCatalogRequest ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await authorizedFetch(path, {
        ...init,
        signal:
          init?.signal ||
          AbortSignal.timeout(
            path.includes("/files/profile") ||
              path.includes("/rag/query") ||
              path.includes("/agent/plan")
              ? path.includes("/agent/plan")
                ? 210_000
                : 140_000
              : isFileCatalogRequest
                ? 8_000
                : 15_000,
          ),
      });
      const payload = (await response.json().catch(() => ({}))) as
        | ResponsePayload
        | ApiErrorPayload;

      if (!response.ok) {
        const code = classifyStatus(response.status);
        const serverMessage =
          "error" in payload && payload.error ? payload.error : `请求失败（${response.status}）`;
        throw new ApiClientError(
          toUserMessage(code, serverMessage),
          response.status,
          code,
          response.status >= 500,
        );
      }

      return payload as ResponsePayload;
    } catch (error) {
      const normalizedError =
        error instanceof ApiClientError
          ? error
          : new ApiClientError("服务暂时不可用，请稍后重试", 0, "NETWORK", true);
      if (!normalizedError.retryable || attempt === maxAttempts) {
        reportGlobalApiError(normalizedError);
        throw normalizedError;
      }
      await wait(retryDelayMs * attempt);
    }
  }

  throw new ApiClientError("服务暂时不可用，请稍后重试", 0, "NETWORK", true);
}

const jsonHeaders = {
  "Content-Type": "application/json",
};

export const bioflowApi = {
  login: async (credentials: { username: string; password: string; role: BioflowRole }) => {
    const response = await requestJson<LoginResponse>("/api/auth/login", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(credentials),
    });
    setAccessToken(response.accessToken);
    return response;
  },

  restoreSession: async () => {
    const response = await requestJson<LoginResponse>("/api/auth/session");
    setAccessToken(response.accessToken);
    return response;
  },

  logout: async () => {
    try {
      await requestJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } finally {
      clearAccessToken();
    }
  },

  listUsers: () => requestJson<UsersResponse>("/api/admin/users"),

  createUser: (input: {
    username: string;
    password: string;
    name: string;
    role: BioflowRole;
    permissions?: BioflowPermission[];
  }) =>
    requestJson<UsersResponse>("/api/admin/users", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  updateUser: (input: {
    id: string;
    name?: string;
    role?: BioflowRole;
    permissions?: BioflowPermission[];
    enabled?: boolean;
    password?: string;
  }) =>
    requestJson<UsersResponse>("/api/admin/users", {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  listProjects: () => requestJson<ProjectsResponse>("/api/projects"),

  createProject: (name: string) =>
    requestJson<ProjectsResponse>("/api/projects", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ name }),
    }),

  deleteProject: (id: string) =>
    requestJson<ProjectsResponse>(`/api/projects?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  getTask: (taskId = "task_demo_rnaseq") =>
    requestJson<TaskResponse>(`/api/tasks/${encodeURIComponent(taskId)}`),

  createTask: (
    title: string,
    options: { skillId?: string; fileIds?: string[]; executionMode?: "real" | "demo" } = {},
  ) =>
    requestJson<TaskResponse>("/api/tasks", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ title, ...options }),
    }),

  deleteTask: (taskId: string) =>
    requestJson<DeleteTaskResponse>(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "DELETE",
    }),

  resetTask: () =>
    requestJson<TaskResponse>("/api/tasks", {
      method: "POST",
    }),

  submitClarifications: (taskId: string, payload: ClarificationPayload) =>
    requestJson<TaskResponse>(`/api/tasks/${encodeURIComponent(taskId)}/clarifications`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),

  approvePlan: (taskId = "task_demo_rnaseq") =>
    requestJson<TaskResponse>(`/api/tasks/${encodeURIComponent(taskId)}/approve`, {
      method: "POST",
    }),

  generatePlan: async (
    taskId: string,
    query: string,
    clarification: Record<string, string>,
    evidence: unknown[] = [],
    options: {
      mode?: AgentMode;
      onEvent?: (event: ApiStreamEvent) => void;
      onOpen?: () => void;
    } = {},
  ) => {
    let result: PlanStreamMessage["result"];
    let failure: Pick<PlanStreamMessage, "error" | "code"> | undefined;
    await readAuthorizedSse<PlanStreamMessage>("/api/agent/plan", {
      signal: AbortSignal.timeout(210_000),
      request: {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          taskId,
          query,
          clarification,
          evidence,
          mode: options.mode ?? DEFAULT_AGENT_MODE,
        }),
      },
      onOpen: options.onOpen,
      onEvent: (message) => {
        options.onEvent?.(message.event);
        if (message.result) result = message.result;
        if (message.error) failure = { error: message.error, code: message.code };
      },
    });
    if (failure?.error) {
      throw new ApiClientError(failure.error, 502, "SERVER", true);
    }
    if (!result) {
      throw new ApiClientError("分析计划事件流已结束，但未返回可审批计划", 502, "SERVER", true);
    }
    return result;
  },

  startRun: (taskId = "task_demo_rnaseq") =>
    requestJson<RunResponse>(`/api/runs?taskId=${encodeURIComponent(taskId)}`, {
      method: "POST",
    }),

  cancelRun: (runId: string) =>
    requestJson<{ ok: boolean }>(`/api/runs/${runId}/cancel`, {
      method: "POST",
    }),

  retryNode: (runId: string, nodeId: string) =>
    requestJson<TaskResponse>(`/api/runs/${runId}/nodes/${nodeId}/retry`, {
      method: "POST",
    }),

  getConfig: () => requestJson<ConfigResponse>("/api/demo/config"),

  saveConfig: (config: DemoConfig) =>
    requestJson<ConfigResponse>("/api/demo/config", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(config),
    }),

  profileTabularFile: (file: File, taskId?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    const query = taskId ? `?taskId=${encodeURIComponent(taskId)}` : "";
    return requestJson<FileProfileResponse>(`/api/files/profile${query}`, {
      method: "POST",
      body: formData,
    });
  },

  getWorkflowLayout: (taskId = "task_demo_rnaseq") =>
    requestJson<WorkflowLayoutResponse>(
      `/api/workflows/workflow_demo/layout?taskId=${encodeURIComponent(taskId)}`,
    ),

  saveWorkflowLayout: (layout: WorkflowLayoutInput, taskId = "task_demo_rnaseq") =>
    requestJson<WorkflowLayoutResponse>(
      `/api/workflows/workflow_demo/layout?taskId=${encodeURIComponent(taskId)}`,
      {
        method: "PUT",
        headers: jsonHeaders,
        body: JSON.stringify(layout),
      },
    ),

  createWorkflowLayoutVersion: (
    name: string,
    layout: WorkflowLayoutInput,
    taskId = "task_demo_rnaseq",
  ) =>
    requestJson<WorkflowLayoutResponse & { version: WorkflowLayoutVersion }>(
      `/api/workflows/workflow_demo/layout?taskId=${encodeURIComponent(taskId)}`,
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ name, ...layout }),
      },
    ),

  runRagQuery: (
    query: string,
    taskId?: string,
    mode: AgentMode = DEFAULT_AGENT_MODE,
    includeAnswer = false,
    conversation?: ConversationMessage[],
  ) =>
    requestJson<RagTraceResponse>(
      `/api/rag/query${taskId ? `?taskId=${encodeURIComponent(taskId)}` : ""}`,
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ query, mode, includeAnswer, conversation }),
      },
    ),

  getRagTrace: (traceId: string) => requestJson<RagTraceResponse>(`/api/rag/traces/${traceId}`),

  getConversation: (taskId: string) =>
    requestJson<ConversationResponse>(`/api/tasks/${encodeURIComponent(taskId)}/conversation`),

  saveConversation: (taskId: string, messages: ConversationMessage[]) =>
    requestJson<ConversationResponse>(`/api/tasks/${encodeURIComponent(taskId)}/conversation`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({ messages }),
    }),

  getNotes: (taskId: string) =>
    requestJson<NotesResponse>(`/api/tasks/${encodeURIComponent(taskId)}/notes`),

  saveNotes: (taskId: string, notes: string) =>
    requestJson<NotesResponse>(`/api/tasks/${encodeURIComponent(taskId)}/notes`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify({ notes }),
    }),

  listSkills: (
    query: {
      search?: string;
      source?: string;
      category?: string;
      availability?: string;
      page?: string;
      pageSize?: number;
    } = {},
  ) => {
    const searchParams = new URLSearchParams();
    searchParams.set("pageSize", String(query.pageSize || 6));
    Object.entries(query).forEach(([key, value]) => {
      if (key !== "pageSize" && value) searchParams.set(key, String(value));
    });
    const queryString = searchParams.toString();
    return requestJson<CatalogPage<SkillRecord>>(
      `/api/skills${queryString ? `?${queryString}` : ""}`,
    );
  },

  getSkill: (skillId: string) => requestJson<SkillResponse>(`/api/skills/${skillId}`),

  createSkill: (input: Record<string, string>) =>
    requestJson<SkillResponse>("/api/skills", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),

  setSkillEnabled: (skillId: string, enabled: boolean) =>
    requestJson<SkillResponse>(`/api/skills/${skillId}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ enabled }),
    }),

  deleteSkill: (skillId: string) =>
    requestJson<DeleteSkillResponse>(`/api/skills/${encodeURIComponent(skillId)}`, {
      method: "DELETE",
    }),

  listProjectFiles: () => requestJson<CatalogPage<ProjectFileRecord>>("/api/files"),

  reparseProjectFile: (fileId: string) =>
    requestJson<ProjectFileResponse>(`/api/files/${fileId}/reparse`, { method: "POST" }),

  deleteProjectFile: (fileId: string) =>
    requestJson<DeleteFileResponse>(`/api/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
    }),
};
