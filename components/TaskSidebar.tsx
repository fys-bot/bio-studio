"use client";

import type { PointerEvent } from "react";
import type { DataFileProfile, TaskListItem } from "@/lib/domain";

type SidebarTask = {
  executionMode?: "real" | "demo";
  id: string;
  title: string;
  status: string;
  progress: number;
  nodes: Array<{ id: string; detail: string }>;
};

type SidebarPanel = "evidence" | "structure";

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
  onUploadFile: () => void;
  onOpenFile: (fileName: string, detail: string) => void;
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
  onUploadFile,
  onOpenFile,
  onResizeStart,
}: TaskSidebarProps) {
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

  return (
    <aside className="task-sidebar">
      <button className="project-head" onClick={onOpenProjectPicker}>
        <div>
          <small>项目</small>
          <strong>{projectName}</strong>
        </div>
        <span>⌄</span>
      </button>
      <div className="side-title">
        <span>
          任务 <em>{taskCards.length}</em>
        </span>
        <button onClick={onCreateTask}>＋ 新建任务</button>
      </div>
      <div className="task-list" aria-label="任务列表">
        {taskCards
          .map((card) =>
            card.id === task.id ? { ...card, status: task.status, progress: task.progress } : card,
          )
          .map((taskCard, taskIndex) => (
            <button
              key={taskCard.id}
              className={`task-item task-button ${activeTaskId === taskCard.id ? "selected" : ""}`}
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
                className={`dot ${taskIndex === 0 ? "yellow" : taskCard.status === "succeeded" ? "blue" : "gray"}`}
              />
              <div>
                <b>{taskCard.title}</b>
                <small>
                  {statusLabels[taskCard.status] || taskCard.status} · {taskCard.progress}%
                  {taskCard.hasUnreadResult ? " · 新结果" : ""}
                </small>
              </div>
            </button>
          ))}
      </div>
      <div className="side-divider" />
      <div className="side-title">
        <span>数据集</span>
        <button data-guide="upload" onClick={onUploadFile}>
          ＋ 上传
        </button>
      </div>
      <div className="dataset-list" aria-label="数据集列表">
        {(task.executionMode !== "real" || countMatrixProfile) && (
          <button
            className="dataset dataset-button"
            onClick={() => onOpenFile("counts.csv", countMatrixDetail)}
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
              onClick={() => onOpenFile(fileName, fileDetail)}
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
    </aside>
  );
}
