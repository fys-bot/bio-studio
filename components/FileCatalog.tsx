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
  const pageSize = 10;
  const [files, setFiles] = useState<ProjectFileRecord[]>([]);
  const [selected, setSelected] = useState<ProjectFileRecord | null>(null);
  const [filter, setFilter] = useState<ProjectFileRecord["status"] | undefined>();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
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

  const matchedFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return files.filter((file) => {
      const matchesStatus = !filter || file.status === filter;
      const matchesQuery = `${file.name} ${file.format} ${file.role} ${file.detail}`
        .toLowerCase()
        .includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [files, filter, query]);
  const pageCount = Math.max(1, Math.ceil(matchedFiles.length / pageSize));
  const visibleFiles = useMemo(
    () => matchedFiles.slice((page - 1) * pageSize, page * pageSize),
    [matchedFiles, page],
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

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
      <div className="catalog-sticky">
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
          <label className="file-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="搜索文件名、格式或解析器"
              aria-label="搜索项目文件"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="清除文件搜索">
                ×
              </button>
            )}
          </label>
          <div className="file-filter-line">
            <div className="filter-row">
              {filterOptions.map((option) => (
                <button
                  key={option.label}
                  className={filter === option.value ? "active" : ""}
                  onClick={() => {
                    setFilter(option.value);
                    setPage(1);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="catalog-meta-inline">
              {matchedFiles.length} 个文件 · 服务端目录快照
            </span>
          </div>
        </section>
      </div>
      <details className="file-source-guide">
        <summary>从专业公开库获取可验证资料</summary>
        <nav aria-label="专业生命科学资料来源">
          <a href="https://www.ncbi.nlm.nih.gov/geo/" target="_blank" rel="noreferrer">
            <b>NCBI GEO</b>
            <span>转录组实验、Series、样本与补充文件</span>
          </a>
          <a href="https://www.encodeproject.org/data/" target="_blank" rel="noreferrer">
            <b>ENCODE</b>
            <span>功能基因组实验、元数据与分析产物</span>
          </a>
          <a
            href="https://bioconductor.org/packages/release/bioc/html/DESeq2.html"
            target="_blank"
            rel="noreferrer"
          >
            <b>Bioconductor / DESeq2</b>
            <span>官方 vignette、手册与示例数据</span>
          </a>
          <a href="https://www.uniprot.org/" target="_blank" rel="noreferrer">
            <b>UniProt</b>
            <span>蛋白序列、功能注释与参考蛋白组</span>
          </a>
          <a href="https://www.rcsb.org/" target="_blank" rel="noreferrer">
            <b>RCSB PDB</b>
            <span>实验测定的生物大分子三维结构</span>
          </a>
          <a href="https://reactome.org/" target="_blank" rel="noreferrer">
            <b>Reactome</b>
            <span>人工审校通路、反应与关系数据</span>
          </a>
        </nav>
      </details>
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
      {!loading && !error && matchedFiles.length > pageSize && (
        <nav className="catalog-pagination" aria-label="文件目录分页">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            上一页
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
            <button
              className={page === pageNumber ? "current" : ""}
              aria-current={page === pageNumber ? "page" : undefined}
              key={pageNumber}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
          <button disabled={page === pageCount} onClick={() => setPage(page + 1)}>
            下一页
          </button>
        </nav>
      )}
      {selected && <FilePreview fileId={selected.id} onClose={() => setSelected(null)} />}
    </main>
  );
}
