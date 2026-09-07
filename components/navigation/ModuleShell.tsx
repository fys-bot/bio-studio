import Link from "next/link";
import type { ReactNode } from "react";
import { GlobalRail } from "@/components/navigation/GlobalRail";
import { listTaskCards } from "@/lib/store";

type ModuleShellProps = {
  section: "skills" | "files" | "project";
  children: ReactNode;
  activeItemId?: string;
};
const skillLinks = [
  ["rnaseq-deseq2", "DESeq2 差异表达", "转录组"],
  ["rag-evidence", "RAG 证据检索", "智能体基础"],
  ["single-cell", "单细胞聚类与注释", "单细胞"],
  ["protein-structure", "蛋白质结构分析", "结构生物学"],
] as const;

/** 二级模块壳层：在页面级路由中保留项目、任务和当前模块上下文。 */
export function ModuleShell({ section, children, activeItemId }: ModuleShellProps) {
  const recentTasks = listTaskCards().slice(-5).reverse();
  const title = section === "skills" ? "能力中心" : section === "files" ? "文件中心" : "项目空间";
  const description =
    section === "skills"
      ? "管理智能体可调用的科研技能"
      : section === "files"
        ? "管理数据、文档与解析状态"
        : "查看任务与项目资源";
  return (
    <div className="module-shell">
      <GlobalRail />
      <aside className="task-sidebar module-sidebar" aria-label="当前项目导航">
        <Link className="project-head" href="/projects/proj_a5211690a4">
          <div>
            <small>项目</small>
            <strong>BioFlow 生命科学实验室</strong>
          </div>
          <span>↗</span>
        </Link>
        <div className="module-context">
          <small>当前位置</small>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <nav className="module-nav" aria-label="最近任务">
          <span className="module-nav-title">最近任务</span>
          {recentTasks.map((task) => (
            <Link key={task.id} href={`/projects/proj_a5211690a4/tasks/${task.id}`}>
              <i className="dot gray" />
              <span>
                <b>{task.title}</b>
                <small>{task.progress}%</small>
              </span>
            </Link>
          ))}
        </nav>
        {section === "skills" && (
          <nav className="module-nav module-subnav" aria-label="常用技能">
            <span className="module-nav-title">常用技能</span>
            {skillLinks.map(([id, label, category]) => (
              <Link
                key={id}
                className={activeItemId === id ? "selected" : ""}
                href={`/skills/${id}`}
              >
                <span className="module-nav-icon">◇</span>
                <span>
                  <b>{label}</b>
                  <small>{category}</small>
                </span>
              </Link>
            ))}
          </nav>
        )}
      </aside>
      <section className="module-content">{children}</section>
    </div>
  );
}
