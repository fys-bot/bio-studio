export type BioflowRole = "researcher" | "reviewer" | "admin";

export type BioflowPermission =
  | "tasks:read"
  | "tasks:write"
  | "files:read"
  | "files:write"
  | "skills:read"
  | "skills:write"
  | "runs:execute"
  | "reviews:write"
  | "users:manage";

export type BioflowSessionUser = {
  id: string;
  username: string;
  name: string;
  role: BioflowRole;
  permissions: BioflowPermission[];
};

export const permissionLabels: Record<BioflowPermission, string> = {
  "tasks:read": "查看任务",
  "tasks:write": "创建与编辑任务",
  "files:read": "查看项目文件",
  "files:write": "上传与重新解析文件",
  "skills:read": "查看能力中心",
  "skills:write": "管理科研技能",
  "runs:execute": "执行 Agent 与计算工作流",
  "reviews:write": "填写审阅意见",
  "users:manage": "管理用户与权限",
};

export const roleDefinitions: Record<
  BioflowRole,
  { label: string; description: string; permissions: BioflowPermission[] }
> = {
  researcher: {
    label: "研究员",
    description: "创建任务、上传材料、运行智能体与真实计算。",
    permissions: [
      "tasks:read",
      "tasks:write",
      "files:read",
      "files:write",
      "skills:read",
      "runs:execute",
      "reviews:write",
    ],
  },
  reviewer: {
    label: "审阅者",
    description: "只读检查任务、证据、结果，并填写审阅意见。",
    permissions: ["tasks:read", "files:read", "skills:read", "reviews:write"],
  },
  admin: {
    label: "管理员",
    description: "管理用户、角色和权限，并拥有工作台全部能力。",
    permissions: [
      "tasks:read",
      "tasks:write",
      "files:read",
      "files:write",
      "skills:read",
      "skills:write",
      "runs:execute",
      "reviews:write",
      "users:manage",
    ],
  },
};

export const allPermissions = Object.keys(permissionLabels) as BioflowPermission[];

export function roleLabel(role: BioflowRole) {
  return roleDefinitions[role].label;
}

export function hasPermission(
  user: Pick<BioflowSessionUser, "permissions"> | null | undefined,
  permission: BioflowPermission,
) {
  return Boolean(user?.permissions.includes(permission));
}
