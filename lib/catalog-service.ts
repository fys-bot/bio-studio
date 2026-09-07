import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CatalogPage, DataFileProfile, ProjectFileRecord, SkillRecord } from "@/lib/domain";
import { snapshot } from "@/lib/store";

type CatalogState = {
  enabledBySkillId: Record<string, boolean>;
  fileStatusById: Record<string, ProjectFileRecord["status"]>;
  customSkills?: SkillRecord[];
};

const catalogStatePath = path.join(process.cwd(), "data", "catalog-state.json");
const defaultCatalogState: CatalogState = { enabledBySkillId: {}, fileStatusById: {} };

const skillCatalog: SkillRecord[] = [
  {
    id: "rnaseq-deseq2",
    name: "DESeq2 差异表达",
    category: "转录组",
    description: "从 Count 矩阵和样本元数据构建设计矩阵，完成差异表达与 FDR 校正。",
    source: "BioFlow Lab",
    enabled: true,
    version: "2.1.0",
    updatedAt: "2026-09-01T08:00:00.000Z",
    status: "available",
    inputs: ["Count 矩阵", "样本元数据", "比较方向"],
    outputs: ["差异基因表", "火山图", "可复现代码"],
  },
  {
    id: "rag-evidence",
    name: "RAG 证据检索",
    category: "智能体基础",
    description: "解析项目文档、混合召回 Top 20、交叉编码器精排并绑定工具参数。",
    source: "BioFlow Lab",
    enabled: true,
    version: "1.8.0",
    updatedAt: "2026-08-28T08:00:00.000Z",
    status: "available",
    inputs: ["研究问题", "项目文件", "知识图谱"],
    outputs: ["证据 Trace", "参数 grounding", "引用列表"],
  },
  {
    id: "single-cell",
    name: "单细胞聚类与注释",
    category: "单细胞",
    description: "执行 QC、降维、聚类和细胞类型注释，保留 marker 基因证据链。",
    source: "Community",
    enabled: false,
    version: "1.4.2",
    updatedAt: "2026-08-20T08:00:00.000Z",
    status: "available",
    inputs: ["表达矩阵", "marker 词典"],
    outputs: ["UMAP", "细胞簇", "注释报告"],
  },
  {
    id: "protein-structure",
    name: "蛋白质结构分析",
    category: "结构生物学",
    description: "加载 PDB/CIF 结构，联动 accession、残基、pLDDT 与文献证据。",
    source: "Team",
    enabled: false,
    version: "0.9.0",
    updatedAt: "2026-08-15T08:00:00.000Z",
    status: "available",
    inputs: ["UniProt accession", "PDB/CIF"],
    outputs: ["3D 结构", "残基证据", "结构摘要"],
  },
  {
    id: "pathway-enrichment",
    name: "通路富集",
    category: "转录组",
    description: "对候选基因执行 GO、KEGG、Reactome 富集并关联知识图谱关系。",
    source: "Community",
    enabled: false,
    version: "1.2.1",
    updatedAt: "2026-08-04T08:00:00.000Z",
    status: "available",
    inputs: ["候选基因", "物种"],
    outputs: ["富集结果", "通路网络"],
  },
  {
    id: "variant-annotation",
    name: "变异注释",
    category: "基因组",
    description: "将 VCF 变异映射到基因、转录本与临床证据，为后续报告提供来源。",
    source: "Mine",
    enabled: false,
    version: "1.0.3",
    updatedAt: "2026-07-30T08:00:00.000Z",
    status: "available",
    inputs: ["VCF", "参考基因组"],
    outputs: ["注释表", "临床证据"],
  },
];

const seedFiles: ProjectFileRecord[] = [
  {
    id: "seed-counts",
    name: "counts.csv",
    format: "CSV",
    role: "RNA-seq Count 矩阵",
    sizeBytes: 2_400_000,
    status: "ready",
    source: "demo-seed",
    version: "seed-1",
    updatedAt: "2026-09-07T08:00:00.000Z",
    detail: "演示样本矩阵 · gene_id + sample columns",
    retryable: false,
  },
  {
    id: "seed-metadata",
    name: "sample_metadata.tsv",
    format: "TSV",
    role: "样本元数据",
    sizeBytes: 12_000,
    status: "ready",
    source: "demo-seed",
    version: "seed-1",
    updatedAt: "2026-09-07T08:00:00.000Z",
    detail: "演示分组字段 · condition / batch",
    retryable: false,
  },
  {
    id: "seed-protocol",
    name: "研究方案.pdf",
    format: "PDF",
    role: "实验方案与方法",
    sizeBytes: 860_000,
    status: "pending",
    source: "demo-seed",
    version: "seed-1",
    updatedAt: "2026-09-06T08:00:00.000Z",
    detail: "等待文档解析与语义切分",
    retryable: true,
  },
  {
    id: "seed-genes",
    name: "候选基因列表.txt",
    format: "TXT",
    role: "候选基因输入",
    sizeBytes: 4_000,
    status: "indexed",
    source: "demo-seed",
    version: "seed-1",
    updatedAt: "2026-09-05T08:00:00.000Z",
    detail: "演示候选基因 · 已关联 Reactome 图谱",
    retryable: false,
  },
];

function readState(): CatalogState {
  try {
    return { ...defaultCatalogState, ...JSON.parse(fs.readFileSync(catalogStatePath, "utf8")) };
  } catch {
    return structuredClone(defaultCatalogState);
  }
}

function persistState(catalogState: CatalogState) {
  try {
    fs.mkdirSync(path.dirname(catalogStatePath), { recursive: true });
    fs.writeFileSync(catalogStatePath, JSON.stringify(catalogState, null, 2));
  } catch {
    // 只读部署仍可读取种子目录，写操作会由 API 返回当前内存结果。
  }
}

function profileToFile(profile: DataFileProfile): ProjectFileRecord {
  return {
    id: profile.id,
    name: profile.fileName,
    format: profile.format,
    role:
      profile.dataRole === "count_matrix"
        ? "RNA-seq Count 矩阵"
        : profile.dataRole === "sample_metadata"
          ? "样本元数据"
          : profile.dataRole === "document"
            ? "研究文档"
            : "结构化表格",
    sizeBytes: profile.sizeBytes,
    status: profile.status === "ready" ? "ready" : "failed",
    source: "user-upload",
    version: `profile-${profile.analyzedAt}`,
    updatedAt: profile.analyzedAt,
    detail:
      profile.dataRole === "document"
        ? profile.recommendations.join(" · ")
        : `${profile.sampleCount} 个样本 · ${profile.columnCount} 个字段 · ${profile.missingCellCount} 个缺失值`,
    retryable: profile.status !== "ready",
  };
}

export function listSkills(query: {
  search?: string;
  source?: string;
  category?: string;
  availability?: string;
  page?: number;
  pageSize?: number;
}): CatalogPage<SkillRecord> {
  const catalogState = readState();
  const search = (query.search ?? "").trim().toLowerCase();
  const filtered = [...skillCatalog, ...(catalogState.customSkills ?? [])]
    .map((skill) => ({
      ...skill,
      enabled: catalogState.enabledBySkillId[skill.id] ?? skill.enabled,
    }))
    .filter(
      (skill) =>
        (!search ||
          `${skill.name} ${skill.description} ${skill.inputs.join(" ")}`
            .toLowerCase()
            .includes(search)) &&
        (!query.source || query.source === "全部来源" || skill.source === query.source) &&
        (!query.category || query.category === "全部分类" || skill.category === query.category) &&
        (!query.availability ||
          query.availability === "全部状态" ||
          (query.availability === "已启用" ? skill.enabled : !skill.enabled)),
    );
  const pageSize = Math.min(20, Math.max(1, query.pageSize ?? 6));
  const page = Math.max(1, query.page ?? 1);
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    source: "server-snapshot",
    updatedAt: new Date().toISOString(),
  };
}

export function getSkill(skillId: string) {
  const catalogState = readState();
  const skill = [...skillCatalog, ...(catalogState.customSkills ?? [])].find(
    (item) => item.id === skillId,
  );
  return skill
    ? { ...skill, enabled: catalogState.enabledBySkillId[skill.id] ?? skill.enabled }
    : undefined;
}

export function setSkillEnabled(skillId: string, enabled: boolean) {
  if (!getSkill(skillId)) return undefined;
  const catalogState = readState();
  catalogState.enabledBySkillId[skillId] = enabled;
  persistState(catalogState);
  return getSkill(skillId);
}

export function createSkill(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("技能内容不能为空");
  const value = input as Record<string, unknown>;
  const read = (key: string, max: number) => {
    const text = typeof value[key] === "string" ? value[key].trim() : "";
    if (!text || text.length > max) throw new Error(`${key} 不能为空且不能超过 ${max} 个字符`);
    return text;
  };
  const list = (key: string) =>
    read(key, 1000)
      .split(/[,，\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  const skill: SkillRecord = {
    id: `skill_${randomUUID()}`,
    name: read("name", 80),
    description: read("description", 1000),
    category: read("category", 40),
    inputs: list("inputs"),
    outputs: list("outputs"),
    instructions: read("instructions", 8000),
    source: "Mine",
    enabled: true,
    version: "1.0.0",
    status: "available",
    updatedAt: new Date().toISOString(),
  };
  const state = readState();
  state.customSkills = [...(state.customSkills ?? []), skill];
  persistState(state);
  return skill;
}

export function listProjectFiles(): CatalogPage<ProjectFileRecord> {
  const catalogState = readState();
  const uploadedFiles = (snapshot().dataProfiles ?? []).map(profileToFile);
  const uploadedNames = new Set(uploadedFiles.map((file) => file.name));
  const items = [
    ...seedFiles.filter((file) => !uploadedNames.has(file.name)),
    ...uploadedFiles,
  ].map((file) => ({ ...file, status: catalogState.fileStatusById[file.id] ?? file.status }));
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: items.length,
    source: "server-snapshot",
    updatedAt: new Date().toISOString(),
  };
}

export function reparseProjectFile(fileId: string) {
  const file = listProjectFiles().items.find((item) => item.id === fileId);
  if (!file) return undefined;
  const catalogState = readState();
  catalogState.fileStatusById[fileId] = "indexed";
  persistState(catalogState);
  return { ...file, status: "indexed" as const, updatedAt: new Date().toISOString() };
}
