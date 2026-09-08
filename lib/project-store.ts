import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type WorkspaceProject = {
  id: string;
  name: string;
  description: string;
  protected: boolean;
  createdAt: string;
};

type ProjectStore = { version: 1; projects: WorkspaceProject[] };

const projectStorePath = () =>
  path.join(
    process.env.BIOFLOW_DATA_DIR || path.join(process.cwd(), "data", "runtime"),
    "projects.json",
  );

const seedProjects: WorkspaceProject[] = [
  {
    id: "proj_a5211690a4",
    name: "BioFlow 生命科学实验室",
    description: "默认演示项目，承载面试验收任务与公开样例。",
    protected: true,
    createdAt: "2026-09-02T00:00:00.000Z",
  },
  {
    id: "proj_tumor_genomics",
    name: "肿瘤基因组项目",
    description: "差异表达、文献证据与候选基因分析。",
    protected: false,
    createdAt: "2026-09-03T00:00:00.000Z",
  },
  {
    id: "proj_protein_engineering",
    name: "蛋白质工程项目",
    description: "结构预览、残基定位与设计记录。",
    protected: false,
    createdAt: "2026-09-04T00:00:00.000Z",
  },
];

function writeStore(store: ProjectStore) {
  const target = projectStorePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, target);
}

function readStore(): ProjectStore {
  try {
    const parsed = JSON.parse(fs.readFileSync(projectStorePath(), "utf8")) as ProjectStore;
    if (parsed.version === 1 && Array.isArray(parsed.projects)) return parsed;
  } catch {
    // 首次启动时建立本机项目目录。
  }
  const created = { version: 1 as const, projects: structuredClone(seedProjects) };
  writeStore(created);
  return created;
}

export function listProjects() {
  return readStore().projects;
}

export function createProject(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ").slice(0, 48);
  if (normalized.length < 2) throw new Error("项目名称至少需要 2 个字符");
  const store = readStore();
  if (store.projects.some((project) => project.name === normalized)) {
    throw new Error("同名项目已经存在");
  }
  const project: WorkspaceProject = {
    id: `proj_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
    name: normalized,
    description: "新建研究项目，等待添加任务和项目文件。",
    protected: false,
    createdAt: new Date().toISOString(),
  };
  store.projects.push(project);
  writeStore(store);
  return project;
}

export function deleteProject(id: string) {
  const store = readStore();
  const project = store.projects.find((item) => item.id === id);
  if (!project) throw new Error("项目不存在");
  if (project.protected) throw new Error("默认演示项目不能删除");
  store.projects = store.projects.filter((item) => item.id !== id);
  writeStore(store);
  return project;
}
