"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import StarBorderRounded from "@mui/icons-material/StarBorderRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import { Button, IconButton, InputAdornment, TextField, Tooltip } from "@mui/material";
import { useEffect, useMemo, useState, type PointerEvent } from "react";
import type { DataFileProfile, TaskListItem } from "@/lib/domain";
import { ConfirmDialog } from "./ui/ConfirmDialog";

type SidebarTask = {
  executionMode?: "real" | "demo";
  id: string;
  title: string;
  status: string;
  progress: number;
  nodes: Array<{ id: string; detail: string }>;
};

type SidebarPanel = "evidence" | "structure";

function taskGroupTone(task: TaskListItem) {
  if (task.id.includes("literature") || task.title.includes("文献")) return "evidence";
  if (task.id.includes("structure") || task.title.includes("蛋白")) return "structure";
  if (task.title.toLowerCase().includes("rna") || task.title.includes("差异表达")) return "rnaseq";
  return "custom";
}

type TaskSidebarProps = {
  task: SidebarTask;
  projectName: string;
  activeTaskId: string;
  taskList: TaskListItem[];
  uploadedFileNames: string[];
  dataProfiles: DataFileProfile[];
  statusLabels: Record<string, string>;
  onOpenProjectPicker: () => void;
  onCreateTask: () => void;
  onSelectTask: (taskId: string, taskLabel: string, panel?: SidebarPanel) => void;
  onDeleteTask: (taskId: string, taskLabel: string) => Promise<void>;
  onUploadFile: () => void;
  onOpenFile: (fileName: string, detail: string, fileId?: string) => void;
  onResizeStart: (event: PointerEvent<HTMLDivElement>) => void;
};

/**
 * 项目级任务导航：只负责呈现任务、数据集和文件入口，业务状态由工作台页面统一管理。
 */
export function TaskSidebar({
  task,
  projectName,
  activeTaskId,
  taskList,
  uploadedFileNames,
  dataProfiles,
  statusLabels,
  onOpenProjectPicker,
  onCreateTask,
  onSelectTask,
  onDeleteTask,
  onUploadFile,
  onOpenFile,
  onResizeStart,
}: TaskSidebarProps) {
  const [taskQuery, setTaskQuery] = useState("");
  const [favoriteTaskIds, setFavoriteTaskIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<TaskListItem | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const countMatrixProfile = dataProfiles.find((profile) => profile.fileName === "counts.csv");
  const metadataProfile = dataProfiles.find(
    (profile) => profile.fileName === "sample_metadata.tsv",
  );
  const additionalFileNames = uploadedFileNames.filter(
    (fileName) => fileName !== "counts.csv" && fileName !== "sample_metadata.tsv",
  );
  const countMatrixDetail = countMatrixProfile
    ? `CSV · ${countMatrixProfile.sampleCount} 个样本 · ${countMatrixProfile.columnCount} 个字段 · ${countMatrixProfile.missingCellCount} 个缺失值`
    : task.status === "clarifying"
      ? "演示种子 · 等待服务端结构检查"
      : task.nodes.find((node) => node.id === "input")?.detail || "服务端文件快照";
  const countMatrixSummary = countMatrixProfile
    ? `结构已就绪 · ${countMatrixProfile.sampleCount} 个样本`
    : "演示种子 · 服务端配置";
  const taskCards = taskList.length
    ? taskList
    : [
        {
          id: task.id,
          title: task.title,
          status: task.status,
          progress: task.progress,
          updatedAt: new Date().toISOString(),
          hasUnreadResult: false,
        },
      ];
  const hasTaskSearch = taskCards.length > 8;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("bioflow-favorite-tasks-v1");
      if (stored) setFavoriteTaskIds(JSON.parse(stored) as string[]);
    } catch {
      setFavoriteTaskIds([]);
    }
  }, []);

  const visibleTaskCards = useMemo(() => {
    const normalizedQuery = taskQuery.trim().toLowerCase();
    return taskCards
      .map((card) =>
        card.id === task.id ? { ...card, status: task.status, progress: task.progress } : card,
      )
      .filter((card) => {
        if (!normalizedQuery) return true;
        return `${card.title} ${statusLabels[card.status] || card.status}`
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftFavorite = favoriteTaskIds.includes(left.id) ? 1 : 0;
        const rightFavorite = favoriteTaskIds.includes(right.id) ? 1 : 0;
        if (leftFavorite !== rightFavorite) return rightFavorite - leftFavorite;
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      });
  }, [favoriteTaskIds, statusLabels, task, taskCards, taskQuery]);

  const toggleFavorite = (taskId: string) => {
    setFavoriteTaskIds((current) => {
      const next = current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [taskId, ...current];
      window.localStorage.setItem("bioflow-favorite-tasks-v1", JSON.stringify(next));
      return next;
    });
  };
  const taskGroups = taskQuery.trim()
    ? [{ label: `搜索结果 ${visibleTaskCards.length}`, items: visibleTaskCards }]
    : [
        {
          label: "收藏",
          items: visibleTaskCards.filter((card) => favoriteTaskIds.includes(card.id)),
        },
        {
          label: favoriteTaskIds.length ? "其他任务" : "全部任务",
          items: visibleTaskCards.filter((card) => !favoriteTaskIds.includes(card.id)),
        },
      ].filter((group) => group.items.length);

  return (
    <aside className="task-sidebar">
      <button className="project-head" onClick={onOpenProjectPicker}>
        <div>
          <small>项目</small>
          <strong>{projectName}</strong>
        </div>
        <ExpandMoreRounded sx={{ fontSize: 18 }} />
      </button>
      <div className="side-title">
        <span>
          任务 <em>{taskCards.length}</em>
        </span>
        <Button size="small" startIcon={<AddRounded />} onClick={onCreateTask}>
          新建任务
        </Button>
      </div>
      {hasTaskSearch && (
        <TextField
          className="task-search"
          fullWidth
          size="small"
          value={taskQuery}
          onChange={(event) => setTaskQuery(event.target.value)}
          placeholder="搜索任务名称或状态"
          slotProps={{
            htmlInput: { "aria-label": "搜索任务名称或状态" },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded sx={{ fontSize: 16 }} />
                </InputAdornment>
              ),
              endAdornment: taskQuery ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setTaskQuery("")}
                    aria-label="清除任务搜索"
                  >
                    <CloseRounded sx={{ fontSize: 15 }} />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            },
          }}
        />
      )}
      <div className="task-list" aria-label="任务列表">
        {visibleTaskCards.length ? (
          taskGroups.map((group) => (
            <section className="task-group" key={group.label} aria-label={group.label}>
              <small className="task-group-label">{group.label}</small>
              {group.items.map((taskCard) => {
                const favorite = favoriteTaskIds.includes(taskCard.id);
                const protectedTask = taskCard.id === "task_demo_rnaseq";
                return (
                  <div
                    key={taskCard.id}
                    className={`task-item-row ${activeTaskId === taskCard.id ? "selected" : ""} ${favorite ? "is-favorite" : ""} ${protectedTask ? "is-protected" : "has-delete"}`}
                  >
                    <button
                      className="task-item task-button"
                      title={taskCard.title}
                      onClick={() =>
                        onSelectTask(
                          taskCard.id,
                          taskCard.title,
                          taskCard.id === "task_literature"
                            ? "evidence"
                            : taskCard.id === "task_structure"
                              ? "structure"
                              : undefined,
                        )
                      }
                    >
                      <i
                        className={`dot task-group-dot ${taskGroupTone(taskCard)}`}
                        title={`${taskCard.title}分组`}
                      />
                      <div>
                        <b>{taskCard.title}</b>
                        <small>
                          {statusLabels[taskCard.status] || taskCard.status} · {taskCard.progress}%
                          {taskCard.hasUnreadResult ? " · 新结果" : ""}
                        </small>
                      </div>
                    </button>
                    <div className="task-row-actions">
                      <Tooltip title={favorite ? "取消收藏" : "收藏任务"}>
                        <IconButton
                          size="small"
                          className="task-favorite"
                          aria-label={
                            favorite ? `取消收藏${taskCard.title}` : `收藏${taskCard.title}`
                          }
                          aria-pressed={favorite}
                          onClick={() => toggleFavorite(taskCard.id)}
                        >
                          {favorite ? (
                            <StarRounded sx={{ fontSize: 17 }} />
                          ) : (
                            <StarBorderRounded sx={{ fontSize: 17 }} />
                          )}
                        </IconButton>
                      </Tooltip>
                      {!protectedTask && (
                        <Tooltip title="删除任务">
                          <IconButton
                            size="small"
                            className="task-delete"
                            aria-label={`删除${taskCard.title}`}
                            onClick={() => {
                              setDeleteError("");
                              setPendingDelete(taskCard);
                            }}
                          >
                            <DeleteOutlineRounded sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          ))
        ) : (
          <div className="task-empty">没有匹配的任务</div>
        )}
      </div>
      <div className="side-divider" />
      <div className="side-title">
        <span>数据集</span>
        <Button
          size="small"
          data-guide="upload"
          startIcon={<CloudUploadOutlined />}
          onClick={onUploadFile}
        >
          上传
        </Button>
      </div>
      <div className="dataset-list" aria-label="数据集列表">
        {(task.executionMode !== "real" || countMatrixProfile) && (
          <button
            className="dataset dataset-button"
            onClick={() => onOpenFile("counts.csv", countMatrixDetail, countMatrixProfile?.id)}
          >
            <span className="file-icon">CSV</span>
            <div>
              <b>counts.csv</b>
              <small>{countMatrixSummary}</small>
            </div>
          </button>
        )}
        {(task.executionMode !== "real" || metadataProfile) && (
          <button
            className="dataset dataset-button"
            onClick={() =>
              onOpenFile(
                "sample_metadata.tsv",
                metadataProfile
                  ? `TSV · ${metadataProfile.sampleCount} 个样本 · ${metadataProfile.columnCount} 个字段 · ${metadataProfile.missingCellCount} 个缺失值`
                  : "样本元数据 · 12 KB · schema 已校验 · condition 字段待映射",
                metadataProfile?.id,
              )
            }
          >
            <span className="file-icon">TSV</span>
            <div>
              <b>sample_metadata.tsv</b>
              <small>
                {metadataProfile
                  ? `结构已就绪 · ${metadataProfile.sampleCount} 个样本`
                  : "12 KB · schema 已校验"}
              </small>
            </div>
          </button>
        )}
        {additionalFileNames.map((fileName) => {
          const dataProfile = dataProfiles.find((profile) => profile.fileName === fileName);
          const fileDetail = dataProfile
            ? `${dataProfile.format} · ${dataProfile.sampleCount} 个样本 · ${dataProfile.columnCount} 个字段 · ${dataProfile.missingCellCount} 个缺失值`
            : "本次会话上传的项目文件";
          return (
            <button
              className="dataset dataset-button"
              key={fileName}
              onClick={() => onOpenFile(fileName, fileDetail, dataProfile?.id)}
            >
              <span className="file-icon">{dataProfile?.format ?? "NEW"}</span>
              <div>
                <b>{fileName}</b>
                <small>
                  {dataProfile
                    ? `${dataProfile.status === "ready" ? "结构已就绪" : "需要字段映射"} · ${dataProfile.sampleCount} 个样本`
                    : "刚刚上传 · 待智能体检查"}
                </small>
              </div>
            </button>
          );
        })}
      </div>
      <div className="sidebar-note">计算服务：本机进程</div>
      <div
        className="vertical-splitter left"
        onPointerDown={onResizeStart}
        title="拖拽调整任务栏宽度"
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`删除任务“${pendingDelete?.title || ""}”？`}
        description="任务的对话、笔记、工作流布局和运行记录会一起删除，删除后无法恢复。"
        busy={Boolean(deletingTaskId)}
        error={deleteError}
        onClose={() => {
          setDeleteError("");
          setPendingDelete(null);
        }}
        onConfirm={() => {
          if (!pendingDelete || deletingTaskId) return;
          const taskToDelete = pendingDelete;
          setDeleteError("");
          setDeletingTaskId(pendingDelete.id);
          void onDeleteTask(taskToDelete.id, taskToDelete.title)
            .then(() => setPendingDelete(null))
            .catch((error) =>
              setDeleteError(error instanceof Error ? error.message : "删除失败，请稍后重试"),
            )
            .finally(() => setDeletingTaskId(""));
        }}
      />
    </aside>
  );
}
