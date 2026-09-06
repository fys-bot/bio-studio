import type { DemoConfig } from "@/lib/demo-config";
import type { ResearchTask, TaskResponse } from "@/lib/domain";

type ApiErrorPayload = {
  error?: string;
};

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

/**
 * 前端 API 适配层：统一错误转换、JSON 解析和请求方法，页面不再直接拼接接口细节。
 */
async function requestJson<ResponsePayload extends object>(
  path: string,
  init?: RequestInit,
): Promise<ResponsePayload> {
  const response = await fetch(path, init);
  const payload = (await response.json().catch(() => ({}))) as
    | ResponsePayload
    | ApiErrorPayload;

  if (!response.ok) {
    const message = "error" in payload && payload.error
      ? payload.error
      : `请求失败（${response.status}）`;
    throw new Error(message);
  }

  return payload as ResponsePayload;
}

const jsonHeaders = {
  "Content-Type": "application/json",
};

export const bioflowApi = {
  login: () => requestJson<LoginResponse>("/api/auth/login", { method: "POST" }),

  getTask: () => requestJson<TaskResponse>("/api/tasks"),

  resetTask: () =>
    requestJson<TaskResponse>("/api/tasks", {
      method: "POST",
    }),

  submitClarifications: (payload: ClarificationPayload) =>
    requestJson<TaskResponse>("/api/tasks/task_demo_rnaseq/clarifications", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }),

  approvePlan: () =>
    requestJson<TaskResponse>("/api/workflows/workflow_demo/approve", {
      method: "POST",
    }),

  startRun: () =>
    requestJson<RunResponse>("/api/runs", {
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
};
