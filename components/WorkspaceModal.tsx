"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import type { DataFileProfile, TabularColumnProfile } from "@/lib/domain";

const columnTypeLabels: Record<TabularColumnProfile["inferredType"], string> = {
  number: "数值",
  category: "分类",
  identifier: "标识符",
  date: "日期",
  text: "文本",
};

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
  dataProfiles: DataFileProfile[];
  uploadingFileName: string;
  uploadError: string;
  newTaskName: string;
  onClose: () => void;
  onSelectProject: (projectName: string) => void;
  onSelectSkill: (skillName: string, skillState: string) => void;
  onOpenFile: (fileName: string, detail: string) => void;
  onNewTaskNameChange: (taskName: string) => void;
  onCreateTask: () => void;
  onUploadFiles: (files: File[]) => void;
  onApplyDataProfile: (profile: DataFileProfile) => void;
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
  dataProfiles,
  uploadingFileName,
  uploadError,
  newTaskName,
  onClose,
  onSelectProject,
  onSelectSkill,
  onOpenFile,
  onNewTaskNameChange,
  onCreateTask,
  onUploadFiles,
  onApplyDataProfile,
  onApplyLayout,
  onConfirmDetail,
}: WorkspaceModalProps) {
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length) onUploadFiles(files);
  };

  const latestDataProfile = dataProfiles.at(-1);
  const availableFileNames = Array.from(
    new Set(["counts.csv", "sample_metadata.tsv", ...uploadedFileNames]),
  );

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
            {availableFileNames.map((fileName) => {
              const dataProfile = dataProfiles.find((profile) => profile.fileName === fileName);
              const profileDetail = dataProfile
                ? `${dataProfile.format} · ${dataProfile.sampleCount} 个样本 · ${dataProfile.columnCount} 个字段 · ${dataProfile.status === "ready" ? "可直接分析" : "需要字段映射"}`
                : fileName.endsWith(".csv")
                  ? "RNA-seq 计数矩阵 · 24 个样本"
                  : "项目文件 · 可供智能体检索与分析";
              return (
                <button key={fileName} onClick={() => onOpenFile(fileName, profileDetail)}>
                  <span>▧</span>
                  <div>
                    <b>{fileName}</b>
                    <small>{dataProfile ? "服务端结构检查已完成" : "本地项目空间"}</small>
                  </div>
                  <em>查看</em>
                </button>
              );
            })}
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
            <label className={`upload-drop ${uploadingFileName ? "is-loading" : ""}`}>
              {uploadingFileName ? "正在检查数据结构…" : "＋ 选择 CSV / TSV 文件"}
              <input
                type="file"
                multiple
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                disabled={Boolean(uploadingFileName)}
                onChange={handleUpload}
              />
              <small>
                {uploadingFileName
                  ? `服务端正在解析 ${uploadingFileName}`
                  : "原始单元格仅在服务端解析，前端只接收字段、缺失值和分组建议"}
              </small>
            </label>
            {uploadError && (
              <p className="upload-error" role="alert">
                {uploadError}
              </p>
            )}
            {latestDataProfile && (
              <section className="data-profile-card" aria-label="文件结构检查结果">
                <header>
                  <div>
                    <small>结构检查完成</small>
                    <h3>{latestDataProfile.fileName}</h3>
                  </div>
                  <span className={latestDataProfile.status}>
                    {latestDataProfile.status === "ready" ? "可直接分析" : "需要映射"}
                  </span>
                </header>
                <div className="profile-metrics">
                  <div>
                    <b>{latestDataProfile.sampleCount}</b>
                    <small>样本</small>
                  </div>
                  <div>
                    <b>{latestDataProfile.columnCount}</b>
                    <small>字段</small>
                  </div>
                  <div>
                    <b>{latestDataProfile.missingCellCount}</b>
                    <small>缺失值</small>
                  </div>
                </div>
                <div className="profile-fields">
                  {latestDataProfile.columns.slice(0, 8).map((column) => (
                    <span key={column.name} title={`${column.distinctCount} 个不同值`}>
                      {column.name}
                      <em>{columnTypeLabels[column.inferredType]}</em>
                    </span>
                  ))}
                </div>
                <div className="profile-recommendation">
                  <small>智能体建议</small>
                  <p>{latestDataProfile.recommendations.join("；")}</p>
                  {latestDataProfile.recognizedFields.condition && (
                    <span>
                      分组字段：<b>{latestDataProfile.recognizedFields.condition}</b>
                    </span>
                  )}
                </div>
                <button
                  className="primary full"
                  onClick={() => onApplyDataProfile(latestDataProfile)}
                >
                  应用到分析上下文
                </button>
              </section>
            )}
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
