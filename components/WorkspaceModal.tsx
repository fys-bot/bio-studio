"use client";

import type { ChangeEvent, KeyboardEvent } from "react";

export type ModalKind =
  | "projects"
  | "skills"
  | "files"
  | "new-task"
  | "upload"
  | "layout"
  | "file"
  | "source";

export type WorkspaceModalState = {
  kind: ModalKind;
  title: string;
  detail?: string;
};

type WorkspaceModalProps = {
  modal: WorkspaceModalState;
  projectName: string;
  uploadedFileNames: string[];
  newTaskName: string;
  onClose: () => void;
  onSelectProject: (projectName: string) => void;
  onSelectSkill: (skillName: string, skillState: string) => void;
  onOpenFile: (fileName: string, detail: string) => void;
  onNewTaskNameChange: (taskName: string) => void;
  onCreateTask: () => void;
  onUploadFiles: (fileNames: string[]) => void;
  onApplyLayout: (layout: "focus" | "workflow" | "reset") => void;
  onConfirmDetail: (kind: "file" | "source") => void;
};

/**
 * 工作区弹窗：统一管理项目、能力、文件、布局和新建任务等短流程。
 * 弹窗只派发用户意图，不直接修改页面状态，便于替换为路由级 Dialog。
 */
export function WorkspaceModal({
  modal,
  projectName,
  uploadedFileNames,
  newTaskName,
  onClose,
  onSelectProject,
  onSelectSkill,
  onOpenFile,
  onNewTaskNameChange,
  onCreateTask,
  onUploadFiles,
  onApplyLayout,
  onConfirmDetail,
}: WorkspaceModalProps) {
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const fileNames = Array.from(event.target.files || []).map((file) => file.name);
    if (fileNames.length) onUploadFiles(fileNames);
  };

  const handleTaskNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") onCreateTask();
  };

  return (
    <div className="ui-modal-backdrop" onMouseDown={onClose}>
      <section
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label={modal.title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>BioFlow 工作区</small>
            <h2>{modal.title}</h2>
          </div>
          <button onClick={onClose} aria-label="关闭弹窗">
            ×
          </button>
        </header>
        {modal.kind === "projects" && (
          <div className="modal-list">
            {["BioFlow 生命科学实验室", "肿瘤基因组项目", "蛋白质工程项目"].map(
              (availableProjectName) => (
                <button
                  key={availableProjectName}
                  className={projectName === availableProjectName ? "selected" : ""}
                  onClick={() => onSelectProject(availableProjectName)}
                >
                  <span>◈</span>
                  <div>
                    <b>{availableProjectName}</b>
                    <small>
                      {availableProjectName === projectName ? "当前项目" : "点击切换项目"}
                    </small>
                  </div>
                  <em>{availableProjectName === projectName ? "✓" : "→"}</em>
                </button>
              ),
            )}
          </div>
        )}
        {modal.kind === "skills" && (
          <div className="modal-list">
            {[
              ["DESeq2 差异表达", "已启用"],
              ["RAG 证据检索", "已启用"],
              ["蛋白质结构分析", "可用"],
            ].map(([skillName, skillState]) => (
              <button key={skillName} onClick={() => onSelectSkill(skillName, skillState)}>
                <span>◇</span>
                <div>
                  <b>{skillName}</b>
                  <small>点击查看能力说明与输入输出</small>
                </div>
                <em>{skillState}</em>
              </button>
            ))}
          </div>
        )}
        {modal.kind === "files" && (
          <div className="modal-list">
            {["counts.csv", "sample_metadata.tsv", ...uploadedFileNames].map((fileName) => (
              <button
                key={fileName}
                onClick={() =>
                  onOpenFile(
                    fileName,
                    fileName.endsWith(".csv")
                      ? "RNA-seq 计数矩阵 · 24 个样本"
                      : "项目文件 · 可供智能体检索与分析",
                  )
                }
              >
                <span>▧</span>
                <div>
                  <b>{fileName}</b>
                  <small>本地项目空间</small>
                </div>
                <em>查看</em>
              </button>
            ))}
          </div>
        )}
        {modal.kind === "new-task" && (
          <div className="modal-form">
            <label>
              任务名称
              <input
                autoFocus
                value={newTaskName}
                onChange={(event) => onNewTaskNameChange(event.target.value)}
                onKeyDown={handleTaskNameKeyDown}
                placeholder="例如：单细胞聚类与细胞注释"
              />
            </label>
            <p>新任务会继承当前项目文件，并从对话澄清开始。</p>
            <div className="modal-actions">
              <button className="secondary" onClick={onClose}>
                取消
              </button>
              <button className="primary" onClick={onCreateTask}>
                创建任务
              </button>
            </div>
          </div>
        )}
        {modal.kind === "upload" && (
          <div className="modal-form">
            <label className="upload-drop">
              ＋ 选择本地文件
              <input type="file" multiple onChange={handleUpload} />
              <small>支持 CSV、TSV、FASTQ、PDB/CIF；演示模式只保存文件名</small>
            </label>
          </div>
        )}
        {modal.kind === "layout" && (
          <div className="modal-list">
            <button onClick={() => onApplyLayout("focus")}>
              <span>◫</span>
              <div>
                <b>对话专注</b>
                <small>收起计划、轨迹和工具抽屉</small>
              </div>
              <em>应用</em>
            </button>
            <button onClick={() => onApplyLayout("workflow")}>
              <span>⌘</span>
              <div>
                <b>工作流布局</b>
                <small>展开可编辑分析计划画布</small>
              </div>
              <em>应用</em>
            </button>
            <button onClick={() => onApplyLayout("reset")}>
              <span>↺</span>
              <div>
                <b>恢复默认布局</b>
                <small>重置分栏、画布、缩放和面板</small>
              </div>
              <em>重置</em>
            </button>
          </div>
        )}
        {(modal.kind === "file" || modal.kind === "source") && (
          <div className="modal-detail">
            <div className="detail-icon">{modal.kind === "source" ? "⌁" : "▧"}</div>
            <p>{modal.detail}</p>
            <dl>
              <div>
                <dt>状态</dt>
                <dd>可用</dd>
              </div>
              <div>
                <dt>数据区域</dt>
                <dd>本地项目空间</dd>
              </div>
              {modal.kind === "source" && (
                <div>
                  <dt>用途</dt>
                  <dd>支撑节点参数与可复现决策</dd>
                </div>
              )}
            </dl>
            <button
              className="primary full"
              onClick={() => onConfirmDetail(modal.kind === "source" ? "source" : "file")}
            >
              确认
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
