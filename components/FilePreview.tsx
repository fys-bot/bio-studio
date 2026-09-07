"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bioflowApi, getApiErrorMessage } from "@/lib/api-client";
import type { ResearchDocument } from "@/lib/research-service";

const labels: Record<string, string> = {
  indexed: "已索引",
  indexing: "向量化中",
  pending: "待索引",
  failed: "索引失败",
  needs_ocr: "需要 OCR",
  empty: "无可索引文本",
};
export function FilePreview({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  const router = useRouter();
  const [document, setDocument] = useState<ResearchDocument | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const response = await fetch(`/api/files/${encodeURIComponent(fileId)}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (!stopped) {
          setDocument(body);
          if (["pending", "indexing"].includes(body.indexStatus)) timer = setTimeout(load, 1500);
        }
      } catch (error) {
        if (!stopped) setError(error instanceof Error ? error.message : "预览失败");
      }
    };
    void load();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("keydown", escape);
    };
  }, [fileId, onClose, refresh]);
  return (
    <div className="ui-modal-backdrop" onMouseDown={onClose}>
      <section
        className="ui-modal document-preview"
        role="dialog"
        aria-modal="true"
        aria-label="文件内容预览"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <small>{document?.parser || "读取文件"}</small>
            <h2>{document?.name || "文件预览"}</h2>
          </div>
          <button aria-label="关闭文件详情" onClick={onClose}>
            ×
          </button>
        </header>
        {error && (
          <p className="document-error" role="alert">
            {error}
          </p>
        )}
        {!document && !error && <p className="document-loading">正在加载正文…</p>}
        {document && (
          <>
            <div className="document-actions">
              <span>
                {labels[document.indexStatus]} · {document.characterCount} 字符 ·{" "}
                {document.chunkCount ?? 0} 块
              </span>
              <a href={`/api/files/${fileId}/original`}>下载原文件</a>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await bioflowApi.createTask(`分析 ${document.name}`, {
                      fileIds: [fileId],
                    });
                    router.push(`/projects/proj_a5211690a4/tasks/${res.task.id}`);
                  } catch (e) {
                    setError(getApiErrorMessage(e, "创建失败"));
                    setBusy(false);
                  }
                }}
              >
                新建任务分析此文件
              </button>
            </div>
            {document.warnings.map((warning, index) => (
              <p className="document-warning" key={index}>
                {warning}
              </p>
            ))}
            {document.indexError && <p className="document-warning">{document.indexError}</p>}
            <div className="document-sections">
              {document.sections.map((section, index) => (
                <section key={index} className="document-section">
                  <h3>
                    {section.locator} <small>{section.origin}</small>
                  </h3>
                  {section.table ? (
                    <div className="document-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            {section.table.columns.map((col, i) => (
                              <th key={i}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.table.rows.map((row, i) => (
                            <tr key={i}>
                              {row.map((cell, j) => (
                                <td key={j}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <pre>{section.text || "此页尚未提取正文"}</pre>
                  )}
                </section>
              ))}
              {document.previewTruncated && (
                <p>预览显示前 50 个段落/表格分组，完整内容请下载原文件。</p>
              )}
            </div>
            <footer className="document-footer">
              <code>SHA-256 {document.sha256}</code>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await bioflowApi.reparseProjectFile(fileId);
                    setRefresh((value) => value + 1);
                    const res = await fetch(`/api/files/${fileId}`);
                    setDocument(await res.json());
                  } catch (e) {
                    setError(getApiErrorMessage(e, "重新解析失败"));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                重新解析并索引
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
