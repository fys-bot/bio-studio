"use client";

import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import DatabaseOutlined from "@mui/icons-material/StorageOutlined";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import {
  Button,
  CircularProgress,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { bioflowApi, getApiErrorMessage } from "@/lib/api-client";
import type { ProjectFileRecord } from "@/lib/domain";
import { FilePreview } from "./FilePreview";
import { CatalogPagination } from "./ui/CatalogPagination";
import { CatalogSearch } from "./ui/CatalogSearch";
import { ResourceLoading } from "./ui/ResourceLoading";

const filterOptions: Array<{ label: string; value?: ProjectFileRecord["status"] }> = [
  { label: "全部" },
  { label: "结构已就绪", value: "ready" },
  { label: "待解析", value: "pending" },
  { label: "已索引", value: "indexed" },
  { label: "解析失败", value: "failed" },
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
  const searchParams = useSearchParams();
  const requestedPreviewName = searchParams.get("previewFile");
  const [files, setFiles] = useState<ProjectFileRecord[]>([]);
  const [selected, setSelected] = useState<ProjectFileRecord | null>(null);
  const [filter, setFilter] = useState<ProjectFileRecord["status"] | undefined>();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [error, setError] = useState("");
  const [browserWidth, setBrowserWidth] = useState(400);
  const [sourceMenuAnchor, setSourceMenuAnchor] = useState<HTMLElement | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = (await bioflowApi.listProjectFiles()).items;
      setFiles(items);
      setSelected((current) => {
        if (current) return items.find((item) => item.id === current.id) ?? null;
        const requested = requestedPreviewName
          ? items.find((item) => item.name === requestedPreviewName)
          : undefined;
        if (requested) return requested;
        const desktopPreview =
          typeof window !== "undefined" && window.matchMedia("(min-width: 701px)").matches;
        if (!desktopPreview) return null;
        return items.find((item) => item.source === "user-upload") ?? items[0] ?? null;
      });
      return items;
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "文件目录加载失败"));
      return [];
    } finally {
      setLoading(false);
    }
  }, [requestedPreviewName]);

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

  const handleUpload = async (file: File) => {
    setError("");
    setUploadingFileName(file.name);
    try {
      await bioflowApi.profileTabularFile(file);
      const items = await loadFiles();
      setSelected(items.find((item) => item.name === file.name) ?? items[0] ?? null);
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError, "文件解析失败"));
    } finally {
      setUploadingFileName("");
    }
  };

  const openSourceMenu = (event: MouseEvent<HTMLElement>) => {
    setSourceMenuAnchor(event.currentTarget);
  };

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    const workspace = event.currentTarget.parentElement;
    if (!workspace) return;
    event.preventDefault();
    const bounds = workspace.getBoundingClientRect();
    const move = (moveEvent: globalThis.PointerEvent) => {
      setBrowserWidth(Math.min(Math.max(moveEvent.clientX - bounds.left, 300), bounds.width - 420));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <main className="catalog-page file-catalog-page">
      <div className="catalog-sticky">
        <header className="catalog-header">
          <h1>文件中心</h1>
          <Button
            component="label"
            variant="contained"
            className="primary upload-button"
            disabled={Boolean(uploadingFileName)}
            startIcon={
              uploadingFileName ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <CloudUploadOutlined />
              )
            }
          >
            {uploadingFileName ? "解析中" : "上传文件"}
            <input
              type="file"
              accept=".csv,.tsv,.txt,.md,.xlsx,.pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
              disabled={Boolean(uploadingFileName)}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file);
                event.currentTarget.value = "";
              }}
            />
          </Button>
        </header>
        <section className="catalog-toolbar file-toolbar">
          <CatalogSearch
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="搜索文件名称、格式或解析器…"
            ariaLabel="文件"
          />
          <div className="file-filter-line">
            <ToggleButtonGroup
              exclusive
              value={filter ?? "all"}
              onChange={(_, value) => {
                if (!value) return;
                setFilter(value === "all" ? undefined : value);
                setPage(1);
              }}
              size="small"
              className="filter-row catalog-toggle-group file-status-filters"
              aria-label="文件解析状态"
            >
              {filterOptions.map((option) => (
                <ToggleButton key={option.label} value={option.value ?? "all"}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <div className="file-filter-aside">
              <span className="catalog-meta-inline">
                {matchedFiles.length} 个文件 · 实时解析目录
              </span>
              <Button
                className="file-source-button"
                variant="outlined"
                size="small"
                startIcon={<DatabaseOutlined />}
                onClick={openSourceMenu}
                aria-haspopup="menu"
                aria-expanded={Boolean(sourceMenuAnchor)}
              >
                专业公开库
              </Button>
              <Menu
                anchorEl={sourceMenuAnchor}
                open={Boolean(sourceMenuAnchor)}
                onClose={() => setSourceMenuAnchor(null)}
                className="file-source-mui-menu"
              >
                {[
                  [
                    "NCBI GEO",
                    "转录组实验、Series 与补充文件",
                    "https://www.ncbi.nlm.nih.gov/geo/",
                  ],
                  ["ENCODE", "功能基因组实验与分析产物", "https://www.encodeproject.org/data/"],
                  ["UniProt", "蛋白序列、功能注释与参考蛋白组", "https://www.uniprot.org/"],
                ].map(([name, detail, href]) => (
                  <MenuItem
                    key={name}
                    component="a"
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setSourceMenuAnchor(null)}
                  >
                    <span>
                      <b>{name}</b>
                      <small>{detail}</small>
                    </span>
                    <OpenInNewRounded sx={{ fontSize: 16 }} />
                  </MenuItem>
                ))}
              </Menu>
            </div>
          </div>
        </section>
      </div>

      {error && (
        <section className="catalog-state error">
          <span>{error}</span>
          <button onClick={() => void loadFiles()}>重新加载</button>
        </section>
      )}

      <section
        className={`file-workspace ${selected ? "has-preview" : ""}`}
        style={{ "--file-browser-width": `${browserWidth}px` } as CSSProperties}
      >
        <div className="file-browser-pane">
          <header className="file-browser-head">
            <div>
              <b>项目文件</b>
              <span>{matchedFiles.length} 项</span>
            </div>
            <span>状态 / 更新</span>
          </header>
          <div className="file-list" aria-busy={loading}>
            {loading && <ResourceLoading variant="files" label="正在读取文件目录" />}
            {!loading &&
              visibleFiles.map((file) => (
                <button
                  className={`file-row ${selected?.id === file.id ? "selected" : ""}`}
                  key={file.id}
                  onClick={() => setSelected(file)}
                  aria-pressed={selected?.id === file.id}
                >
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
                    <small>{new Date(file.updatedAt).toLocaleDateString("zh-CN")}</small>
                  </span>
                  <ChevronRightRounded sx={{ fontSize: 17 }} />
                </button>
              ))}
            {!loading && visibleFiles.length === 0 && (
              <div className="catalog-state">当前筛选没有文件。</div>
            )}
          </div>
          {!loading && (
            <CatalogPagination
              page={page}
              count={pageCount}
              label="文件目录分页"
              onChange={setPage}
            />
          )}
        </div>

        {selected && (
          <>
            <div
              className="file-workspace-divider"
              role="separator"
              aria-orientation="vertical"
              aria-label="调整文件列表宽度"
              onPointerDown={startResize}
            >
              <i />
            </div>
            <FilePreview
              mode="panel"
              fileId={selected.id}
              onClose={() => setSelected(null)}
              onFileUpdated={(updatedFile) => {
                setFiles((items) =>
                  items.map((item) => (item.id === updatedFile.id ? updatedFile : item)),
                );
                setSelected(updatedFile);
              }}
            />
          </>
        )}
      </section>
    </main>
  );
}
