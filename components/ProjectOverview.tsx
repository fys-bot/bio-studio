"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import ExtensionRounded from "@mui/icons-material/ExtensionRounded";
import FolderOutlined from "@mui/icons-material/FolderOutlined";
import ScienceOutlined from "@mui/icons-material/ScienceOutlined";
import TaskAltRounded from "@mui/icons-material/TaskAltRounded";
import { Button, Chip, CircularProgress, TextField } from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { bioflowApi, getApiErrorMessage } from "@/lib/api-client";
import type { TaskListItem } from "@/lib/domain";
import type { WorkspaceProject } from "@/lib/project-store";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { ResponsiveDialog } from "./ui/ResponsiveDialog";

const taskStatusLabel: Record<string, string> = {
  draft: "草稿",
  clarifying: "待补充",
  awaiting_approval: "待审批",
  queued: "排队中",
  running: "运行中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

export function ProjectOverview({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftName, setDraftName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [projectResponse, taskResponse] = await Promise.all([
        bioflowApi.listProjects(),
        bioflowApi.getTask("task_demo_rnaseq"),
      ]);
      setProjects(projectResponse.projects);
      setTasks(taskResponse.tasks ?? []);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "项目空间加载失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const project = useMemo(
    () => projects.find((item) => item.id === projectId) ?? projects[0],
    [projectId, projects],
  );
  const completedTasks = tasks.filter((task) => task.status === "succeeded").length;

  if (loading) {
    return (
      <main className="project-overview-page">
        <div className="project-overview-loading" role="status">
          <CircularProgress size={20} />
          <span>正在读取项目与任务状态</span>
        </div>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="project-overview-page">
        <section className="project-overview-error">
          <span>{error || "项目不存在"}</span>
          <Button variant="outlined" onClick={() => void load()}>
            重新加载
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="project-overview-page">
      <header className="project-overview-header">
        <div className="project-overview-title">
          <span className="project-overview-glyph">
            <ScienceOutlined sx={{ fontSize: 22 }} />
          </span>
          <div>
            <small>PROJECT / 项目空间</small>
            <h1>{project.name}</h1>
            <p>{project.description}</p>
          </div>
        </div>
        <div className="project-overview-actions">
          <Button variant="outlined" startIcon={<AddRounded />} onClick={() => setCreating(true)}>
            新建项目
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineRounded />}
            disabled={project.protected}
            onClick={() => setDeleting(true)}
          >
            删除项目
          </Button>
        </div>
      </header>

      <section className="project-overview-metrics" aria-label="项目概览">
        <div>
          <TaskAltRounded />
          <span>
            <b>{tasks.length}</b>
            <small>任务总数</small>
          </span>
        </div>
        <div>
          <span className="project-metric-signal" />
          <span>
            <b>{completedTasks}</b>
            <small>已完成</small>
          </span>
        </div>
        <div>
          <span className="project-metric-signal active" />
          <span>
            <b>{tasks.length - completedTasks}</b>
            <small>进行中或待处理</small>
          </span>
        </div>
        <Chip size="small" label={project.protected ? "默认演示项目" : "本机项目"} />
      </section>

      <section className="project-overview-grid">
        <article className="project-task-panel">
          <header>
            <div>
              <h2>任务队列</h2>
              <small>按最近更新时间排列，点击进入完整工作流</small>
            </div>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => router.push(`/projects/${project.id}/tasks/task_demo_rnaseq`)}
            >
              进入工作台
            </Button>
          </header>
          <div className="project-task-list">
            {tasks.slice(0, 8).map((task) => (
              <button
                type="button"
                key={task.id}
                onClick={() => router.push(`/projects/${project.id}/tasks/${task.id}`)}
              >
                <span className={`project-task-dot status-${task.status}`} />
                <span>
                  <b>{task.title}</b>
                  <small>
                    {taskStatusLabel[task.status] || task.status} · {task.progress}%
                  </small>
                </span>
                <ArrowForwardRounded sx={{ fontSize: 17 }} />
              </button>
            ))}
          </div>
        </article>

        <aside className="project-resource-panel">
          <h2>项目资源</h2>
          <button type="button" onClick={() => router.push("/files")}>
            <FolderOutlined sx={{ fontSize: 19 }} />
            <span>
              <b>文件中心</b>
              <small>上传、解析、预览和索引研究材料</small>
            </span>
            <ArrowForwardRounded sx={{ fontSize: 17 }} />
          </button>
          <button type="button" onClick={() => router.push("/skills")}>
            <ExtensionRounded sx={{ fontSize: 19 }} />
            <span>
              <b>能力中心</b>
              <small>管理可调用的计算器与检索技能</small>
            </span>
            <ArrowForwardRounded sx={{ fontSize: 17 }} />
          </button>
          <div className="project-storage-note">
            <b>当前持久化</b>
            <p>项目元数据保存在本机 JSON；科研文档与计算作业保存在 SQLite。</p>
          </div>
        </aside>
      </section>

      <ResponsiveDialog
        open={creating}
        title="新建项目"
        eyebrow="项目空间"
        busy={busy}
        onClose={() => setCreating(false)}
        actions={
          <>
            <Button color="inherit" disabled={busy} onClick={() => setCreating(false)}>
              取消
            </Button>
            <Button
              variant="contained"
              disabled={busy || draftName.trim().length < 2}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const response = await bioflowApi.createProject(draftName);
                  setProjects(response.projects);
                  setCreating(false);
                  setDraftName("");
                  if (response.project) router.replace(`/projects/${response.project.id}`);
                } catch (createError) {
                  setError(getApiErrorMessage(createError, "项目创建失败"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "创建中" : "创建项目"}
            </Button>
          </>
        }
      >
        <TextField
          autoFocus
          fullWidth
          label="项目名称"
          placeholder="例如：免疫治疗队列"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
        />
      </ResponsiveDialog>

      <ConfirmDialog
        open={deleting}
        title="删除项目"
        description={`确定删除“${project.name}”吗？项目目录记录会被移除，此操作不可撤销。`}
        busy={busy}
        error={error}
        onClose={() => {
          setDeleting(false);
          setError("");
        }}
        onConfirm={async () => {
          setBusy(true);
          setError("");
          try {
            const response = await bioflowApi.deleteProject(project.id);
            const fallback = response.projects[0];
            setDeleting(false);
            if (fallback) router.replace(`/projects/${fallback.id}`);
            else router.replace("/projects/proj_a5211690a4");
          } catch (deleteError) {
            setError(getApiErrorMessage(deleteError, "项目删除失败"));
          } finally {
            setBusy(false);
          }
        }}
      />
    </main>
  );
}
