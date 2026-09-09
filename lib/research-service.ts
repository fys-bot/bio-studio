import type { ProjectFileRecord } from "./domain";
import fs from "node:fs";
import path from "node:path";

export class ResearchServiceError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ResearchServiceError";
    this.status = status;
  }
}

export type ResearchDocument = {
  id: string;
  name: string;
  format: string;
  sizeBytes: number;
  sha256: string;
  createdAt: number;
  parser: string;
  source?: "demo-seed" | "user-upload";
  indexStatus: "pending" | "indexing" | "indexed" | "failed" | "needs_ocr" | "empty";
  indexError?: string;
  needsOcr: boolean;
  characterCount: number;
  chunkCount?: number;
  embeddingModel?: string;
  dimensions?: number;
  warnings: string[];
  previewTruncated?: boolean;
  sections: Array<{
    text: string;
    locator: string;
    origin: string;
    table?: { columns: string[]; rows: string[][] };
  }>;
  routes: Array<{ page: number; strategy: string }>;
};

export type AnalysisJob = {
  id: string;
  taskId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  error?: string;
  createdAt: number;
  result?: {
    engine: string;
    version: string;
    design: string;
    sampleCount: number;
    summary: { testedGeneCount: number; significantGeneCount: number; candidateGeneCount: number };
    candidateGenes: Array<{
      symbol: string;
      fdr: number;
      log2FoldChange: number;
      direction: "up" | "down";
    }>;
    artifacts: string[];
  };
};

const researchRuntimeRegistry = globalThis as typeof globalThis & {
  __bioflowResolvedWorker?: {
    url: string;
    checkedAt: number;
    apiVersion: number;
    contractRevision: number;
  };
};

const REQUIRED_WORKER_CONTRACT_REVISION = 3;

function workerHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  nextHeaders.set(
    "X-Bioflow-Worker-Token",
    process.env.BIOFLOW_WORKER_TOKEN || "local-development-only",
  );
  return nextHeaders;
}

function localWorkerUrl() {
  if (process.env.BIOFLOW_WORKER_URL) return process.env.BIOFLOW_WORKER_URL;
  if (process.env.NODE_ENV === "production") return "http://127.0.0.1:8000";
  try {
    const line = fs
      .readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
      .split(/\r?\n/)
      .find((item) => item.startsWith("BIOFLOW_WORKER_URL="));
    return line?.slice("BIOFLOW_WORKER_URL=".length).trim() || "http://127.0.0.1:8000";
  } catch {
    return "http://127.0.0.1:8000";
  }
}

async function resolvedWorkerUrl() {
  const cached = researchRuntimeRegistry.__bioflowResolvedWorker;
  if (
    cached &&
    cached.apiVersion >= 2 &&
    cached.contractRevision >= REQUIRED_WORKER_CONTRACT_REVISION &&
    Date.now() - cached.checkedAt < 30_000
  ) {
    return cached.url;
  }
  const configured = localWorkerUrl();
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    return configured;
  }
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) return configured;
  const configuredPort = Number(parsed.port || 8000);
  const candidates = [
    configuredPort,
    configuredPort + 1,
    configuredPort + 2,
    configuredPort + 3,
    8000,
  ]
    .filter((port, index, ports) => ports.indexOf(port) === index)
    .map((port) => `${parsed.protocol}//${parsed.hostname}:${port}`);
  for (const candidate of candidates) {
    try {
      const response = await fetch(`${candidate}/health`, {
        headers: workerHeaders(),
        cache: "no-store",
        signal: AbortSignal.timeout(900),
      });
      if (!response.ok) continue;
      const health = (await response.json().catch(() => ({}))) as {
        apiVersion?: number;
        contractRevision?: number;
        features?: string[];
      };
      const apiVersion = Number(health.apiVersion || 0);
      const contractRevision = Number(health.contractRevision || 0);
      if (
        apiVersion < 2 ||
        contractRevision < REQUIRED_WORKER_CONTRACT_REVISION ||
        !health.features?.includes("agent-plan")
      )
        continue;
      researchRuntimeRegistry.__bioflowResolvedWorker = {
        url: candidate,
        checkedAt: Date.now(),
        apiVersion,
        contractRevision,
      };
      return candidate;
    } catch {
      continue;
    }
  }
  return configured;
}

export async function researchResponse(path: string, init: RequestInit = {}, timeout = 30_000) {
  const headers = workerHeaders(init.headers);
  let response: Response;
  try {
    const workerUrl = await resolvedWorkerUrl();
    response = await fetch(`${workerUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    researchRuntimeRegistry.__bioflowResolvedWorker = undefined;
    throw new Error("科研服务未连接，请运行 npm run services；页面无需更换 3000 端口");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ResearchServiceError(
      typeof body.detail === "string" ? body.detail : `科研服务返回 ${response.status}`,
      response.status,
    );
  }
  return response;
}

export async function researchJson<T>(
  path: string,
  init: RequestInit = {},
  timeout?: number,
): Promise<T> {
  return (await researchResponse(path, init, timeout)).json() as Promise<T>;
}

export function documentToFile(document: ResearchDocument): ProjectFileRecord {
  return {
    id: document.id,
    name: document.name,
    format: document.format,
    role: "项目文档",
    sizeBytes: document.sizeBytes,
    status:
      document.indexStatus === "indexed"
        ? "indexed"
        : document.indexStatus === "failed"
          ? "failed"
          : document.indexStatus === "needs_ocr"
            ? "pending"
            : "ready",
    source: document.source || "user-upload",
    version: document.sha256.slice(0, 12),
    updatedAt: new Date(document.createdAt * 1000).toISOString(),
    detail: `${document.parser} · ${document.characterCount} 字符 · ${document.indexStatus}`,
    retryable: document.indexStatus !== "indexed",
  };
}
