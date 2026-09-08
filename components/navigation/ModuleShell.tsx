import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import Link from "next/link";
import type { ReactNode } from "react";
import { GlobalRail } from "@/components/navigation/GlobalRail";
import { ModuleContent } from "@/components/navigation/ModuleContent";
import { listTaskCards } from "@/lib/store";

type ModuleShellProps = {
  section: "skills" | "files" | "project" | "admin";
  children: ReactNode;
};

function taskGroupTone(task: { id: string; title: string }) {
  if (task.id.includes("literature") || task.title.includes("文献")) return "evidence";
  if (task.id.includes("structure") || task.title.includes("蛋白")) return "structure";
  if (task.title.toLowerCase().includes("rna") || task.title.includes("差异表达")) return "rnaseq";
  return "custom";
}

/** 二级模块壳层：在页面级路由中保留项目、任务和当前模块上下文。 */
export function ModuleShell({ section, children }: ModuleShellProps) {
  const recentTasks = listTaskCards().slice(-5).reverse();
  const title =
    section === "skills"
      ? "能力中心"
      : section === "files"
        ? "文件中心"
        : section === "admin"
          ? "权限管理"
          : "项目空间";
  const description =
    section === "skills"
      ? "管理智能体可调用的科研技能"
      : section === "files"
        ? "管理数据、文档与解析状态"
        : section === "admin"
          ? "创建用户并分配角色和原子权限"
          : "查看任务与项目资源";
  return (
    <div
      className={`module-shell ${section === "project" ? "has-module-sidebar" : "without-module-sidebar"}`}
    >
      <GlobalRail />
      {section === "project" && (
        <aside className="task-sidebar module-sidebar" aria-label="当前项目导航">
          <Link className="project-head" href="/projects/proj_a5211690a4">
            <div>
              <small>项目</small>
              <strong>BioFlow 生命科学实验室</strong>
            </div>
            <ArrowOutwardRounded sx={{ fontSize: 18 }} />
          </Link>
          <div className="module-context">
            <small>当前位置</small>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <nav className="module-nav module-task-nav" aria-label="最近任务">
            <span className="module-nav-title">最近任务</span>
            {recentTasks.map((task) => (
              <Link key={task.id} href={`/projects/proj_a5211690a4/tasks/${task.id}`}>
                <i className={`dot task-group-dot ${taskGroupTone(task)}`} />
                <span>
                  <b>{task.title}</b>
                  <small>{task.progress}%</small>
                </span>
              </Link>
            ))}
          </nav>
        </aside>
      )}
      <ModuleContent>{children}</ModuleContent>
    </div>
  );
}
