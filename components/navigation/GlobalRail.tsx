"use client";

import BiotechRounded from "@mui/icons-material/BiotechRounded";
import DashboardCustomizeRounded from "@mui/icons-material/DashboardCustomizeRounded";
import ExtensionRounded from "@mui/icons-material/ExtensionRounded";
import FolderOutlined from "@mui/icons-material/FolderOutlined";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import { ListItemIcon, Menu, MenuItem } from "@mui/material";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { bioflowApi } from "@/lib/api-client";

const items = [
  {
    href: "/projects/proj_a5211690a4/tasks/task_demo_rnaseq",
    icon: DashboardCustomizeRounded,
    label: "工作台",
    match: (path: string) => path === "/" || path.startsWith("/projects"),
  },
  {
    href: "/skills",
    icon: ExtensionRounded,
    label: "能力中心",
    match: (path: string) => path.startsWith("/skills"),
  },
  {
    href: "/files",
    icon: FolderOutlined,
    label: "文件",
    match: (path: string) => path.startsWith("/files"),
  },
];

/** 全站一级导航，保证资源中心与 Agent 工作台共享一致的产品上下文。 */
export function GlobalRail() {
  const pathname = usePathname();
  const router = useRouter();
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const openAccount = (event: MouseEvent<HTMLButtonElement>) =>
    setAccountAnchor(event.currentTarget);
  return (
    <aside className="rail global-rail" aria-label="BioFlow 主导航">
      <Link
        className="brand"
        href="/projects/proj_a5211690a4/tasks/task_demo_rnaseq"
        aria-label="BioFlow 工作台首页"
      >
        <BiotechRounded sx={{ fontSize: 24 }} />
      </Link>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            className={`rail-btn ${item.match(pathname) ? "active" : ""}`}
            href={item.href}
            aria-current={item.match(pathname) ? "page" : undefined}
          >
            <Icon className="rail-icon" sx={{ fontSize: 19 }} />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <div className="rail-spacer" />
      <button
        className="avatar"
        aria-label="当前账户：DF 研究员"
        aria-haspopup="menu"
        aria-expanded={Boolean(accountAnchor)}
        onClick={openAccount}
      >
        DF
      </button>
      <Menu
        anchorEl={accountAnchor}
        open={Boolean(accountAnchor)}
        onClose={() => setAccountAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <MenuItem disabled>
          <ListItemIcon>
            <PersonOutlineRounded fontSize="small" />
          </ListItemIcon>
          DF 研究员
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAccountAnchor(null);
            void bioflowApi.logout().finally(() => router.push("/login"));
          }}
        >
          <ListItemIcon>
            <LogoutRounded fontSize="small" />
          </ListItemIcon>
          退出登录
        </MenuItem>
      </Menu>
    </aside>
  );
}
