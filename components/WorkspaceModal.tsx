"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import AccountTreeRounded from "@mui/icons-material/AccountTreeRounded";
import CenterFocusStrongRounded from "@mui/icons-material/CenterFocusStrongRounded";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";
import ScienceOutlined from "@mui/icons-material/ScienceOutlined";
import { Button, ButtonBase, IconButton, TextField, Tooltip } from "@mui/material";
import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import type { DataFileProfile, TabularColumnProfile } from "@/lib/domain";
import type { WorkspaceProject } from "@/lib/project-store";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { ResponsiveDialog } from "./ui/ResponsiveDialog";

const columnTypeLabels: Record<TabularColumnProfile["inferredType"], string> = {
  number: "数值",
  category: "分类",
  identifier: "标识符",
  date: "日期",
  text: "文本",
};

export type ModalKind = "projects" | "new-task" | "upload" | "layout" | "file" | "source";

export type WorkspaceModalState = {
  kind: ModalKind;
  title: string;
  detail?: string;
};

type WorkspaceModalProps = {
  modal: WorkspaceModalState;
  projects: WorkspaceProject[];
  activeProjectId: string;
  projectName: string;
  dataProfiles: DataFileProfile[];
  uploadingFileName: string;
  uploadError: string;
  newTaskName: string;
  onClose: () => void;
  onSelectProject: (project: WorkspaceProject) => void;
  onCreateProject: (projectName: string) => Promise<void>;
  onDeleteProject: (project: WorkspaceProject) => Promise<void>;
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
  projects,
  activeProjectId,
  projectName,
  dataProfiles,
  uploadingFileName,
  uploadError,
  newTaskName,
  onClose,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onOpenFile,
  onNewTaskNameChange,
  onCreateTask,
  onUploadFiles,
  onApplyDataProfile,
  onApplyLayout,
  onConfirmDetail,
}: WorkspaceModalProps) {
  const [projectDraft, setProjectDraft] = useState("");
  const [projectBusy, setProjectBusy] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [pendingProjectDelete, setPendingProjectDelete] = useState<WorkspaceProject | null>(null);
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length) onUploadFiles(files);
  };

  const latestDataProfile = dataProfiles.at(-1);
  const handleTaskNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") onCreateTask();
  };

  return (
    <ResponsiveDialog
      open
      title={modal.title}
      eyebrow="BioFlow 工作区"
      maxWidth={modal.kind === "upload" ? "md" : "sm"}
      onClose={onClose}
      className="workspace-responsive-dialog"
    >
      <div className="workspace-modal-body">
        {modal.kind === "projects" && (
          <div className="project-manager">
            <div className="project-manager-summary">
              <div>
                <b>项目空间</b>
                <small>{projects.length} 个项目，切换后保留当前任务上下文</small>
              </div>
              <span>本机持久化</span>
            </div>
            <form
              className="project-create-row"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!projectDraft.trim() || projectBusy) return;
                setProjectBusy(true);
                setProjectError("");
                try {
                  await onCreateProject(projectDraft);
                  setProjectDraft("");
                } catch (error) {
                  setProjectError(error instanceof Error ? error.message : "项目创建失败");
                } finally {
                  setProjectBusy(false);
                }
              }}
            >
              <TextField
                size="small"
                value={projectDraft}
                onChange={(event) => setProjectDraft(event.target.value)}
                label="新项目名称"
                placeholder="例如：免疫治疗队列"
                fullWidth
              />
              <Button
                type="submit"
                variant="contained"
                startIcon={<AddRounded />}
                disabled={projectBusy || projectDraft.trim().length < 2}
              >
                新建
              </Button>
            </form>
            {projectError && <p className="project-manager-error">{projectError}</p>}
            <div className="modal-list project-list">
              {projects.map((project) => {
                const selected = project.id === activeProjectId || project.name === projectName;
                return (
                  <div className={`project-option ${selected ? "selected" : ""}`} key={project.id}>
                    <button
                      className="project-option-main"
                      onClick={() => onSelectProject(project)}
                    >
                      <span className="project-option-icon">
                        <ScienceOutlined sx={{ fontSize: 18 }} />
                      </span>
                      <div>
                        <b>{project.name}</b>
                        <small>{selected ? "当前项目" : project.description}</small>
                      </div>
                      {selected ? (
                        <CheckRounded sx={{ fontSize: 17 }} />
                      ) : (
                        <ArrowForwardRounded sx={{ fontSize: 17 }} />
                      )}
                    </button>
                    <Tooltip title={project.protected ? "默认演示项目不能删除" : "删除项目"}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={project.protected}
                          aria-label={`删除${project.name}`}
                          onClick={() => setPendingProjectDelete(project)}
                        >
                          <DeleteOutlineRounded sx={{ fontSize: 18 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
            <small className="project-manager-note">
              项目目录保存在本机运行数据中；默认演示项目受保护。
            </small>
          </div>
        )}
        {modal.kind === "new-task" && (
          <div className="modal-form">
            <TextField
              autoFocus
              fullWidth
              label="任务名称"
              value={newTaskName}
              onChange={(event) => onNewTaskNameChange(event.target.value)}
              onKeyDown={handleTaskNameKeyDown}
              placeholder="例如：单细胞聚类与细胞注释"
              slotProps={{ htmlInput: { maxLength: 80 } }}
            />
            <p>新任务会继承当前项目文件，并从对话澄清开始。</p>
            <div className="modal-actions">
              <Button className="secondary" variant="outlined" onClick={onClose}>
                取消
              </Button>
              <Button
                className="primary"
                variant="contained"
                startIcon={<AddRounded />}
                disabled={newTaskName.trim().length < 2}
                onClick={onCreateTask}
              >
                创建任务
              </Button>
            </div>
          </div>
        )}
        {modal.kind === "upload" && (
          <div className="modal-form">
            <label className={`upload-drop ${uploadingFileName ? "is-loading" : ""}`}>
              {uploadingFileName ? "正在解析文件…" : "＋ 选择数据或研究文档"}
              <input
                type="file"
                multiple
                accept=".csv,.tsv,.txt,.md,.xlsx,.pdf,.docx,text/csv,text/tab-separated-values,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={Boolean(uploadingFileName)}
                onChange={handleUpload}
              />
              <small>
                {uploadingFileName
                  ? `服务端正在解析 ${uploadingFileName}`
                  : "CSV / TSV / Excel / PDF / DOCX / TXT / MD / 图片 · 最大 10MB"}
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
                    <b>
                      {latestDataProfile.dataRole === "document"
                        ? latestDataProfile.recordCount
                        : latestDataProfile.sampleCount}
                    </b>
                    <small>{latestDataProfile.dataRole === "document" ? "非空段落" : "样本"}</small>
                  </div>
                  <div>
                    <b>{latestDataProfile.columnCount}</b>
                    <small>{latestDataProfile.dataRole === "document" ? "标题" : "字段"}</small>
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
                {latestDataProfile.processing && (
                  <div className="profile-processing" aria-label="文档处理阶段">
                    {latestDataProfile.processing.stages.map((stage) => (
                      <span className={stage.status} key={stage.key} title={stage.detail}>
                        <i /> {stage.label}
                      </span>
                    ))}
                  </div>
                )}
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
          <div className="modal-list layout-option-list">
            <ButtonBase className="layout-option" onClick={() => onApplyLayout("focus")}>
              <span className="layout-option-icon">
                <CenterFocusStrongRounded sx={{ fontSize: 19 }} />
              </span>
              <div>
                <b>对话专注</b>
                <small>收起计划、轨迹和工具抽屉</small>
              </div>
              <em>应用</em>
            </ButtonBase>
            <ButtonBase className="layout-option" onClick={() => onApplyLayout("workflow")}>
              <span className="layout-option-icon">
                <AccountTreeRounded sx={{ fontSize: 19 }} />
              </span>
              <div>
                <b>工作流布局</b>
                <small>展开可编辑工作流画布</small>
              </div>
              <em>应用</em>
            </ButtonBase>
            <ButtonBase className="layout-option" onClick={() => onApplyLayout("reset")}>
              <span className="layout-option-icon">
                <RestartAltRounded sx={{ fontSize: 19 }} />
              </span>
              <div>
                <b>恢复默认布局</b>
                <small>重置分栏、画布、缩放和面板</small>
              </div>
              <em>重置</em>
            </ButtonBase>
          </div>
        )}
        {(modal.kind === "file" || modal.kind === "source") && (
          <div className="modal-detail">
            <div className="detail-icon">{modal.kind === "source" ? "⌁" : "▧"}</div>
            <p>{modal.detail}</p>
            {modal.kind === "file" && (
              <div className="modal-detail-notice">
                这是演示输入模板或文件入口说明。绑定真实文件后会打开正文、表格和索引状态；
                当前不会用虚构解析结果代替真实内容。
              </div>
            )}
            <dl>
              <div>
                <dt>状态</dt>
                <dd>{modal.kind === "source" ? "已绑定" : "仅入口说明"}</dd>
              </div>
              <div>
                <dt>数据区域</dt>
                <dd>{modal.kind === "source" ? "项目证据索引" : "演示上下文"}</dd>
              </div>
              {modal.kind === "source" && (
                <div>
                  <dt>用途</dt>
                  <dd>支撑节点参数与可复现决策</dd>
                </div>
              )}
            </dl>
            <Button
              className="primary full"
              variant="contained"
              onClick={() => onConfirmDetail(modal.kind === "source" ? "source" : "file")}
            >
              确认
            </Button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(pendingProjectDelete)}
        title="删除项目"
        description={`确定删除“${pendingProjectDelete?.name || ""}”吗？项目目录记录会被移除，此操作不可撤销。`}
        confirmLabel="确认删除"
        busy={projectBusy}
        error={projectError}
        onClose={() => {
          setPendingProjectDelete(null);
          setProjectError("");
        }}
        onConfirm={async () => {
          if (!pendingProjectDelete) return;
          setProjectBusy(true);
          setProjectError("");
          try {
            await onDeleteProject(pendingProjectDelete);
            setPendingProjectDelete(null);
          } catch (error) {
            setProjectError(error instanceof Error ? error.message : "项目删除失败");
          } finally {
            setProjectBusy(false);
          }
        }}
      />
    </ResponsiveDialog>
  );
}
