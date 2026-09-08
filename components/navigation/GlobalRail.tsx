"use client";

import BiotechRounded from "@mui/icons-material/BiotechRounded";
import DashboardCustomizeRounded from "@mui/icons-material/DashboardCustomizeRounded";
import ExtensionRounded from "@mui/icons-material/ExtensionRounded";
import FolderOutlined from "@mui/icons-material/FolderOutlined";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import MenuBookRounded from "@mui/icons-material/MenuBookRounded";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import HubOutlined from "@mui/icons-material/HubOutlined";
import StreamRounded from "@mui/icons-material/StreamRounded";
import ViewInArOutlined from "@mui/icons-material/ViewInArOutlined";
import { Divider, ListItemIcon, ListSubheader, Menu, MenuItem } from "@mui/material";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { bioflowApi } from "@/lib/api-client";
import { roleLabel } from "@/lib/access-control";
import { useAuthSession } from "@/components/auth/AuthSessionGate";

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
  const { user } = useAuthSession();
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
      {user?.permissions.includes("users:manage") && (
        <Link
          className={`rail-btn ${pathname.startsWith("/admin") ? "active" : ""}`}
          href="/admin/users"
          aria-current={pathname.startsWith("/admin") ? "page" : undefined}
        >
          <AdminPanelSettingsRounded className="rail-icon" sx={{ fontSize: 19 }} />
          <span>权限</span>
        </Link>
      )}
      <div className="rail-spacer" />
      <button
        className="avatar"
        aria-label={`当前账户：${user?.name || "我的"}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(accountAnchor)}
        onClick={openAccount}
      >
        <span className="avatar-initials">{user?.name.slice(0, 2).toUpperCase() || "我"}</span>
        <span className="avatar-label">我的</span>
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
          {user ? `${user.name} · ${roleLabel(user.role)}` : "当前账户"}
        </MenuItem>
        <Divider />
        <ListSubheader>亮点实例</ListSubheader>
        <MenuItem onClick={() => router.push("/projects/proj_a5211690a4/tasks/task_demo_rnaseq")}>
          <ListItemIcon>
            <StreamRounded fontSize="small" />
          </ListItemIcon>
          真实计算 + SSE
        </MenuItem>
        <MenuItem onClick={() => router.push("/projects/proj_a5211690a4/tasks/task_literature")}>
          <ListItemIcon>
            <HubOutlined fontSize="small" />
          </ListItemIcon>
          文档 RAG
        </MenuItem>
        <MenuItem onClick={() => router.push("/projects/proj_a5211690a4/tasks/task_structure")}>
          <ListItemIcon>
            <ViewInArOutlined fontSize="small" />
          </ListItemIcon>
          3D 结构
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setAccountAnchor(null);
            router.push("/projects/proj_a5211690a4/tasks/task_demo_rnaseq?docs=1");
          }}
        >
          <ListItemIcon>
            <MenuBookRounded fontSize="small" />
          </ListItemIcon>
          开发与验收手册
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAccountAnchor(null);
            router.push("/projects/proj_a5211690a4/tasks/task_demo_rnaseq?guide=1");
          }}
        >
          <ListItemIcon>
            <HelpOutlineRounded fontSize="small" />
          </ListItemIcon>
          从 0 到 1 指引
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
