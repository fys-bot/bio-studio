"use client";

import {
  Download,
  ExternalLink,
  FileSearch,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { bioflowApi, getApiErrorMessage } from "@/lib/api-client";
import type { ProjectFileRecord } from "@/lib/domain";
import type { ResearchDocument } from "@/lib/research-service";

const labels: Record<string, string> = {
  indexed: "已索引",
  indexing: "向量化中",
  pending: "待索引",
  failed: "索引失败",
  needs_ocr: "需要 OCR",
  empty: "无可索引文本",
};

type FilePreviewProps = {
  fileId: string;
  mode?: "modal" | "panel";
  onClose?: () => void;
  onFileUpdated?: (file: ProjectFileRecord) => void;
};

function StructuredPreview({ document }: { document: ResearchDocument }) {
  return (
    <div className="document-sections">
      {document.sections.map((section, index) => (
        <section key={`${section.locator}-${index}`} className="document-section">
          <h3>
            {section.locator} <small>{section.origin}</small>
          </h3>
          {section.table ? (
            <div className="document-table-scroll">
              <table>
                <thead>
                  <tr>
                    {section.table.columns.map((column, columnIndex) => (
                      <th key={columnIndex}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="document-text-page">{section.text || "此页尚未提取正文"}</div>
          )}
        </section>
      ))}
      {!document.sections.length && (
        <div className="document-empty">
          <FileSearch size={24} />
          <b>当前文件没有可显示的结构化正文</b>
          <span>可以下载原文件，或重新运行解析与 OCR 路由。</span>
        </div>
      )}
      {document.previewTruncated && (
        <p className="document-truncated">当前显示前 50 个内容分组，完整内容请下载原文件。</p>
      )}
    </div>
  );
}

function DocxPreview({ document }: { document: ResearchDocument }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const container = containerRef.current;
      if (!container) return;
      setLoading(true);
      setRenderError("");
      container.replaceChildren();
      try {
        const response = await fetch(`/api/files/${encodeURIComponent(document.id)}/original`);
        if (!response.ok) throw new Error("原始 DOCX 文件读取失败");
        const [{ renderAsync }, data] = await Promise.all([
          import("docx-preview"),
          response.arrayBuffer(),
        ]);
        if (cancelled) return;
        await renderAsync(data, container, container, {
          breakPages: true,
          experimental: true,
          ignoreFonts: false,
          inWrapper: true,
          renderFooters: true,
          renderHeaders: true,
          useBase64URL: true,
        });
      } catch (error) {
        if (!cancelled)
          setRenderError(error instanceof Error ? error.message : "DOCX 版式还原失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [document.id]);

  return (
    <div className="document-native-preview document-docx-preview">
      {loading && <div className="document-render-state">正在还原 DOCX 页面与版式…</div>}
      {renderError && (
        <div className="document-render-fallback">
          <p>{renderError}，已切换到服务端解析正文。</p>
          <StructuredPreview document={document} />
        </div>
      )}
      <div ref={containerRef} className={renderError ? "is-hidden" : "docx-render-root"} />
    </div>
  );
}

function DocumentRenderer({ document }: { document: ResearchDocument }) {
  const format = `${document.format} ${document.name}`.toLowerCase();
  const originalUrl = `/api/files/${encodeURIComponent(document.id)}/original`;

  if (/docx/.test(format)) return <DocxPreview document={document} />;
  if (/pdf/.test(format)) {
    return (
      <div className="document-native-preview document-pdf-preview">
        <iframe title={`${document.name} PDF 预览`} src={`${originalUrl}#view=FitH&toolbar=1`} />
      </div>
    );
  }
  if (/png|jpe?g|image/.test(format)) {
    return (
      <div className="document-native-preview document-image-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={originalUrl} alt={document.name} />
      </div>
    );
  }
  return <StructuredPreview document={document} />;
}

export function FilePreview({ fileId, mode = "modal", onClose, onFileUpdated }: FilePreviewProps) {
  const router = useRouter();
  const [document, setDocument] = useState<ResearchDocument | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    setDocument(null);
    setError("");
    const load = async () => {
      try {
        const response = await fetch(`/api/files/${encodeURIComponent(fileId)}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (!stopped) {
          setDocument(body);
          if (["pending", "indexing"].includes(body.indexStatus)) timer = setTimeout(load, 1500);
        }
      } catch (loadError) {
        if (!stopped) setError(loadError instanceof Error ? loadError.message : "文件预览失败");
      }
    };
    void load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [fileId, refresh]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (fullscreen) setFullscreen(false);
      else onClose?.();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [fullscreen, onClose]);

  const reparse = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await bioflowApi.reparseProjectFile(fileId);
      onFileUpdated?.(response.file);
      setRefresh((value) => value + 1);
    } catch (reparseError) {
      setError(getApiErrorMessage(reparseError, "重新解析失败"));
    } finally {
      setBusy(false);
    }
  };

  const preview = (
    <section
      className={`document-preview ${mode === "panel" ? "document-preview-panel" : "ui-modal"} ${fullscreen ? "is-fullscreen" : ""}`}
      role={mode === "modal" || fullscreen ? "dialog" : "region"}
      aria-modal={mode === "modal" || fullscreen ? "true" : undefined}
      aria-label="文件内容预览"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header>
        <div className="document-title">
          <small>{document?.parser || "正在读取解析结果"}</small>
          <h2>{document?.name || "文件预览"}</h2>
        </div>
        <div className="document-toolbar">
          <button
            type="button"
            disabled={busy}
            onClick={() => void reparse()}
            title="重新解析并索引"
          >
            <RefreshCw size={15} className={busy ? "is-spinning" : ""} />
          </button>
          <a
            href={`/api/files/${encodeURIComponent(fileId)}/original?download=1`}
            title="下载原文件"
          >
            <Download size={15} />
          </a>
          <button
            type="button"
            onClick={() => setFullscreen((current) => !current)}
            title={fullscreen ? "退出全屏" : "全屏预览"}
          >
            {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          {onClose && (
            <button type="button" aria-label="关闭文件预览" onClick={onClose} title="关闭预览">
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {error && (
        <p className="document-error" role="alert">
          {error}
        </p>
      )}
      {!document && !error && <div className="document-render-state">正在读取文件正文…</div>}
      {document && (
        <>
          <div className="document-meta-bar">
            <span className={`document-index-state ${document.indexStatus}`}>
              {labels[document.indexStatus]}
            </span>
            <span>{document.characterCount.toLocaleString("zh-CN")} 字符</span>
            <span>{document.chunkCount ?? 0} 个检索块</span>
            <span>{document.source === "demo-seed" ? "示例资料" : "用户上传"}</span>
            {document.needsOcr && <span className="needs-ocr">OCR 待处理</span>}
          </div>
          {(document.warnings.length > 0 || document.indexError) && (
            <details className="document-warning-panel">
              <summary>解析提示 {document.warnings.length + (document.indexError ? 1 : 0)}</summary>
              {document.warnings.map((warning, index) => (
                <p key={index}>{warning}</p>
              ))}
              {document.indexError && <p>{document.indexError}</p>}
            </details>
          )}
          <div className="document-preview-body">
            <DocumentRenderer document={document} />
          </div>
          <footer className="document-footer">
            <code title={`SHA-256 ${document.sha256}`}>
              SHA-256 {document.sha256.slice(0, 16)}…
            </code>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const response = await bioflowApi.createTask(`分析 ${document.name}`, {
                    fileIds: [fileId],
                  });
                  router.push(`/projects/proj_a5211690a4/tasks/${response.task.id}`);
                } catch (createError) {
                  setError(getApiErrorMessage(createError, "创建分析任务失败"));
                  setBusy(false);
                }
              }}
            >
              <ExternalLink size={14} />
              新建分析任务
            </button>
          </footer>
        </>
      )}
    </section>
  );

  if (mode === "panel") return preview;
  return (
    <div className="ui-modal-backdrop" onMouseDown={onClose}>
      {preview}
    </div>
  );
}
