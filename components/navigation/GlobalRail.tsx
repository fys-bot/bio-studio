"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/projects/proj_a5211690a4/tasks/task_demo_rnaseq",
    icon: "⌘",
    label: "工作台",
    match: (path: string) => path === "/" || path.startsWith("/projects"),
  },
  {
    href: "/skills",
    icon: "◇",
    label: "能力中心",
    match: (path: string) => path.startsWith("/skills"),
  },
  { href: "/files", icon: "◈", label: "文件", match: (path: string) => path.startsWith("/files") },
];

/** 全站一级导航，保证资源中心与 Agent 工作台共享一致的产品上下文。 */
export function GlobalRail() {
  const pathname = usePathname();
  return (
    <aside className="rail global-rail" aria-label="BioFlow 主导航">
      <Link
        className="brand"
        href="/projects/proj_a5211690a4/tasks/task_demo_rnaseq"
        aria-label="BioFlow 工作台首页"
      >
        ⦿
      </Link>
      {items.map((item) => (
        <Link
          key={item.href}
          className={`rail-btn ${item.match(pathname) ? "active" : ""}`}
          href={item.href}
          aria-current={item.match(pathname) ? "page" : undefined}
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
      <div className="rail-spacer" />
      <button className="avatar" aria-label="当前账户：DF 研究员">
        DF
      </button>
    </aside>
  );
}
