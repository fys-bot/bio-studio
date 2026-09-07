import type { ProjectFileRecord } from "./domain";
import fs from "node:fs";
import path from "node:path";

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

export async function researchResponse(path: string, init: RequestInit = {}, timeout = 30_000) {
  const headers = new Headers(init.headers);
  headers.set(
    "X-Bioflow-Worker-Token",
    process.env.BIOFLOW_WORKER_TOKEN || "local-development-only",
  );
  let response: Response;
  try {
    response = await fetch(`${localWorkerUrl()}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw new Error("科研服务未连接，请运行 npm run services；页面无需更换 3000 端口");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.detail === "string" ? body.detail : `科研服务返回 ${response.status}`,
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
