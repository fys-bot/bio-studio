"use client";

import type { PointerEvent } from "react";

type SidebarTask = {
  title: string;
  status: string;
  progress: number;
};

type SidebarPanel = "evidence" | "structure";

type TaskSidebarProps = {
  task: SidebarTask;
  projectName: string;
  activeTaskId: string;
  extraTaskNames: string[];
  uploadedFileNames: string[];
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
  extraTaskNames,
  uploadedFileNames,
  statusLabels,
  onOpenProjectPicker,
  onCreateTask,
  onSelectTask,
  onUploadFile,
  onOpenFile,
  onResizeStart,
}: TaskSidebarProps) {
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
          任务 <em>{3 + extraTaskNames.length}</em>
        </span>
        <button onClick={onCreateTask}>＋ 新建任务</button>
      </div>
      <button
        className={`task-item task-button ${activeTaskId === "rna" ? "selected" : ""}`}
        onClick={() => onSelectTask("rna", task.title)}
      >
        <i className="dot yellow" />
        <div>
          <b>{task.title}</b>
          <small>
            {statusLabels[task.status] || task.status} · {task.progress}%
          </small>
        </div>
      </button>
      <button
        className={`task-item task-button ${activeTaskId === "literature" ? "selected" : ""}`}
        onClick={() => onSelectTask("literature", "文献证据图谱", "evidence")}
      >
        <i className="dot blue" />
        <div>
          <b>文献证据图谱</b>
          <small>已完成 · 2 小时前</small>
        </div>
      </button>
      <button
        className={`task-item task-button ${activeTaskId === "structure" ? "selected" : ""}`}
        onClick={() => onSelectTask("structure", "蛋白质结构预览", "structure")}
      >
        <i className="dot gray" />
        <div>
          <b>蛋白质结构预览</b>
          <small>草稿 · 昨天</small>
        </div>
      </button>
      {extraTaskNames.map((taskName, taskIndex) => (
        <button
          key={`${taskName}-${taskIndex}`}
          className={`task-item task-button ${
            activeTaskId === `extra-${taskIndex}` ? "selected" : ""
          }`}
          onClick={() => onSelectTask(`extra-${taskIndex}`, taskName)}
        >
          <i className="dot gray" />
          <div>
            <b>{taskName}</b>
            <small>草稿 · 刚刚</small>
          </div>
        </button>
      ))}
      <div className="side-divider" />
      <div className="side-title">
        <span>数据集</span>
        <button onClick={onUploadFile}>＋ 上传</button>
      </div>
      <button
        className="dataset dataset-button"
        onClick={() =>
          onOpenFile("counts.csv", "RNA-seq 计数矩阵 · 2.4 MB · 24 个样本 · 18,432 个基因")
        }
      >
        <span className="file-icon">CSV</span>
        <div>
          <b>counts.csv</b>
          <small>2.4 MB · 24 个样本</small>
        </div>
      </button>
      <button
        className="dataset dataset-button"
        onClick={() =>
          onOpenFile(
            "sample_metadata.tsv",
            "样本元数据 · 12 KB · schema 已校验 · condition 字段待映射",
          )
        }
      >
        <span className="file-icon">TSV</span>
        <div>
          <b>sample_metadata.tsv</b>
          <small>12 KB · schema 已校验</small>
        </div>
      </button>
      {uploadedFileNames.map((fileName) => (
        <button
          className="dataset dataset-button"
          key={fileName}
          onClick={() => onOpenFile(fileName, "本次会话上传的项目文件")}
        >
          <span className="file-icon">NEW</span>
          <div>
            <b>{fileName}</b>
            <small>刚刚上传 · 待智能体检查</small>
          </div>
        </button>
      ))}
      <div className="sidebar-note">⌁ 云端计算会在你离开页面后继续运行。</div>
      <div
        className="vertical-splitter left"
        onPointerDown={onResizeStart}
        title="拖拽调整任务栏宽度"
      />
    </aside>
  );
}
