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

export type LoginResponse = {
  authenticated: boolean;
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
export type RagTraceResponse = { trace: RagTrace };
export type SkillResponse = { skill: SkillRecord };
export type ProjectFileResponse = { file: ProjectFileRecord };

/**
 * 前端 API 适配层：统一错误转换、JSON 解析和请求方法，页面不再直接拼接接口细节。
 */
const retryDelayMs = 180;

const classifyStatus = (status: number): ApiErrorCode => {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status >= 400 && status < 500) return "VALIDATION";
  return "SERVER";
};

const toUserMessage = (code: ApiErrorCode, fallback: string) => {
  if (code === "UNAUTHORIZED") return "登录状态已失效，请刷新页面";
  if (code === "FORBIDDEN") return "当前操作没有权限";
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
  const maxAttempts = method === "GET" ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(path, {
        ...init,
        signal:
          init?.signal ||
          AbortSignal.timeout(
            path.includes("/files/profile") || path.includes("/rag/query") ? 120_000 : 15_000,
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
  login: () => requestJson<LoginResponse>("/api/auth/login", { method: "POST" }),

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

  generatePlan: (
    taskId: string,
    query: string,
    clarification: Record<string, string>,
    evidence: unknown[] = [],
  ) =>
    requestJson<TaskResponse>("/api/agent/plan", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ taskId, query, clarification, evidence }),
    }),

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

  runRagQuery: (query: string, taskId?: string) =>
    requestJson<RagTraceResponse>(
      `/api/rag/query${taskId ? `?taskId=${encodeURIComponent(taskId)}` : ""}`,
      {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ query }),
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
    query: { search?: string; source?: string; category?: string; page?: string } = {},
  ) => {
    const searchParams = new URLSearchParams();
    searchParams.set("pageSize", "12");
    Object.entries(query).forEach(([key, value]) => value && searchParams.set(key, value));
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

  listProjectFiles: () => requestJson<CatalogPage<ProjectFileRecord>>("/api/files"),

  reparseProjectFile: (fileId: string) =>
    requestJson<ProjectFileResponse>(`/api/files/${fileId}/reparse`, { method: "POST" }),
};
