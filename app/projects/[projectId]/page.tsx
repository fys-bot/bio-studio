import Link from "next/link";
import { ModuleShell } from "@/components/navigation/ModuleShell";

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  return (
    <ModuleShell section="project">
      <main className="project-page">
        <Link href="/" className="back-link">
          ← 返回工作台
        </Link>
        <span className="catalog-kicker">PROJECT / 项目空间</span>
        <h1>BioFlow 生命科学实验室</h1>
        <p>项目 ID：{params.projectId}</p>
        <div className="project-actions">
          <Link className="primary" href={`/projects/${params.projectId}/tasks/task_demo_rnaseq`}>
            打开 RNA-seq 演示任务 →
          </Link>
          <Link className="secondary" href="/skills">
            管理能力中心
          </Link>
          <Link className="secondary" href="/files">
            查看项目文件
          </Link>
        </div>
      </main>
    </ModuleShell>
  );
}
