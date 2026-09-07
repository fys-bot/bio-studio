"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { bioflowApi, getApiErrorMessage } from "@/lib/api-client";
import type { ProjectFileRecord } from "@/lib/domain";
import { FilePreview } from "./FilePreview";

const filterOptions: Array<{ label: string; value?: ProjectFileRecord["status"] }> = [
  { label: "全部" },
  { label: "结构已就绪", value: "ready" },
  { label: "待解析", value: "pending" },
  { label: "已索引", value: "indexed" },
];

const statusLabels: Record<ProjectFileRecord["status"], string> = {
  ready: "结构已就绪",
  pending: "待解析",
  indexed: "已索引",
  failed: "解析失败",
};

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function FileCatalog() {
  const [files, setFiles] = useState<ProjectFileRecord[]>([]);
  const [selected, setSelected] = useState<ProjectFileRecord | null>(null);
  const [filter, setFilter] = useState<ProjectFileRecord["status"] | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reparsing, setReparsing] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await bioflowApi.login();
      setFiles((await bioflowApi.listProjectFiles()).items);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "文件目录加载失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const visibleFiles = useMemo(
    () => files.filter((file) => !filter || file.status === filter),
    [files, filter],
  );

  const reparse = async (file: ProjectFileRecord) => {
    setReparsing(true);
    try {
      const response = await bioflowApi.reparseProjectFile(file.id);
      setFiles((items) => items.map((item) => (item.id === file.id ? response.file : item)));
      setSelected(response.file);
    } catch (reparseError) {
      setError(getApiErrorMessage(reparseError, "文件重新解析失败"));
    } finally {
      setReparsing(false);
    }
  };

  const handleUpload = async (file: File) => {
    try {
      await bioflowApi.profileTabularFile(file);
      await loadFiles();
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError, "文件解析失败"));
    }
  };

  return (
    <main className="catalog-page">
      <header className="catalog-header">
        <div>
          <Link href="/projects/proj_a5211690a4/tasks/task_demo_rnaseq" className="back-link">
            ← 返回工作台
          </Link>
          <span className="catalog-kicker">PROJECT FILES / 文件中心</span>
          <h1>文件中心</h1>
        </div>
        <label className="primary upload-button">
          ＋ 上传文件
          <input
            type="file"
            accept=".csv,.tsv,.txt,.md,.xlsx,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </header>
      <section className="catalog-toolbar file-toolbar">
        <div className="filter-row">
          {filterOptions.map((option) => (
            <button
              key={option.label}
              className={filter === option.value ? "active" : ""}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="catalog-meta-inline">{visibleFiles.length} 个文件 · 服务端目录快照</span>
      </section>
      {loading && <section className="catalog-state">正在读取文件目录…</section>}
      {error && (
        <section className="catalog-state error">
          <span>{error}</span>
          <button onClick={() => void loadFiles()}>重新加载</button>
        </section>
      )}
      {!loading && !error && (
        <section className="file-list">
          {visibleFiles.map((file) => (
            <button className="file-row" key={file.id} onClick={() => setSelected(file)}>
              <span className="file-type">{file.format}</span>
              <span className="file-main">
                <b>{file.name}</b>
                <small>
                  {file.role} · {file.detail}
                </small>
              </span>
              <span
                className={`file-status ${
                  file.status === "pending" || file.status === "failed" ? "pending" : "ready"
                }`}
              >
                {statusLabels[file.status]}
              </span>
              <span className="file-size">
                {formatBytes(file.sizeBytes)}
                <br />
                <small>{new Date(file.updatedAt).toLocaleDateString("zh-CN")}</small>
              </span>
              <span>→</span>
            </button>
          ))}
          {visibleFiles.length === 0 && <div className="catalog-state">当前筛选没有文件。</div>}
        </section>
      )}
      {selected && <FilePreview fileId={selected.id} onClose={() => setSelected(null)} />}
    </main>
  );
}
