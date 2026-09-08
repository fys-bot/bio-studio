"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import DataObjectRounded from "@mui/icons-material/DataObjectRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import HubOutlined from "@mui/icons-material/HubOutlined";
import OutputRounded from "@mui/icons-material/OutputRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import ScienceOutlined from "@mui/icons-material/ScienceOutlined";
import SecurityRounded from "@mui/icons-material/SecurityRounded";
import SettingsSuggestRounded from "@mui/icons-material/SettingsSuggestRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bioflowApi, getApiErrorMessage } from "@/lib/api-client";
import type { SkillRecord } from "@/lib/domain";
import { CatalogPagination } from "./ui/CatalogPagination";
import { CatalogSearch } from "./ui/CatalogSearch";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { ResourceLoading } from "./ui/ResourceLoading";
import { ResponsiveDialog } from "./ui/ResponsiveDialog";
import { SelectControl } from "./ui/SelectControl";

const sources = ["全部来源", "BioFlow Lab", "Team", "Community", "Mine"];
const availabilityOptions = ["全部状态", "已启用", "可用"];

type SkillRuntimeSpec = {
  level: "verified" | "adapter";
  badge: string;
  engine: string;
  summary: string;
  binding: string;
  scenarios: string[];
  dependencies: string[];
  boundaries: string[];
  parameters: Array<{ name: string; value: string }>;
  steps: Array<{ title: string; detail: string }>;
  fallback: string[];
};

const verifiedRuntimeSpecs: Record<string, SkillRuntimeSpec> = {
  "rnaseq-deseq2": {
    level: "verified",
    badge: "真实计算器已绑定",
    engine: "PyDESeq2 0.5.4 · SQLite 队列 · 独立 Python Worker",
    summary: "上传并校验矩阵和样本表后，提交真实异步统计作业，持续返回状态并生成结果文件。",
    binding: "POST /api/tasks/:taskId/analysis",
    scenarios: ["处理组与对照组差异表达", "批次协变量设计", "结果表、火山图与方法报告交付"],
    dependencies: [
      "Count 矩阵：基因为行、样本为列，值为非负整数",
      "样本元数据：样本 ID 与矩阵列一一对应",
      "比较方向与设计公式：运行前由用户确认",
    ],
    boundaries: [
      "不直接处理 FASTQ 原始测序文件，需先完成定量",
      "PyDESeq2 是 Python 实现，不保证与 R DESeq2 逐值完全一致",
      "统计结果需要结合实验设计与生物学背景复核",
    ],
    parameters: [
      { name: "设计公式", value: "condition，可选 batch 协变量" },
      { name: "比较方向", value: "treated vs control，由用户确认" },
      { name: "显著性", value: "FDR 0.05，Benjamini-Hochberg 校正" },
      { name: "低计数过滤", value: "总 Count ≥ 10" },
    ],
    steps: [
      { title: "输入校验", detail: "核对整数矩阵、样本映射、分组水平和缺失值。" },
      { title: "设计确认", detail: "锁定比较方向、协变量、过滤阈值和交付要求。" },
      { title: "异步计算", detail: "写入 SQLite 队列，由独立 Worker 执行 PyDESeq2。" },
      { title: "结果交付", detail: "生成 CSV、PNG 与 Markdown 报告并保留运行状态。" },
    ],
    fallback: [
      "输入不匹配时停止提交，并返回具体字段或样本差异。",
      "Worker 失败时保留失败状态和错误信息，支持修正配置后重试。",
      "刷新页面后从服务端恢复作业进度，不用重新发起计算。",
    ],
  },
  "rag-evidence": {
    level: "verified",
    badge: "真实检索链路已绑定",
    engine: "FastEmbed 384 维 · Qdrant · BM25 / cosine / RRF",
    summary: "对项目文件执行格式路由、清洗、分段、向量化和混合检索，并返回可追溯原文片段。",
    binding: "POST /api/rag/query",
    scenarios: ["研究方案问答", "分析参数 grounding", "项目文档证据追溯"],
    dependencies: [
      "已解析并完成索引的项目文件",
      "Qdrant Local Mode 或 Qdrant Server",
      "FastEmbed 多语言向量模型；交叉编码器为可选配置",
    ],
    boundaries: [
      "未配置交叉编码器时只声明 RRF 排序，不伪称语义精排",
      "扫描 PDF 的 OCR 质量取决于已配置的视觉模型与页面质量",
      "检索片段用于证据辅助，不替代原文核对和专业判断",
    ],
    parameters: [
      { name: "检索范围", value: "当前任务绑定的 fileIds" },
      { name: "候选召回", value: "BM25 + cosine" },
      { name: "融合排序", value: "Reciprocal Rank Fusion" },
      { name: "精排", value: "环境变量配置后启用 cross-encoder" },
    ],
    steps: [
      { title: "策略路由", detail: "按 PDF、Office、表格和纯文本选择对应解析器。" },
      { title: "清洗分段", detail: "保留标题、表格和页码来源，清理重复空白与噪声。" },
      { title: "索引检索", detail: "写入 Qdrant，并在限定文件范围内执行混合召回。" },
      { title: "来源回传", detail: "返回命中文本、文件、分数和排序策略用于审计。" },
    ],
    fallback: [
      "视觉 OCR 未配置时回退到可提取文本，并明确记录路由结果。",
      "可选 reranker 不可用时保留 BM25 + cosine + RRF 结果。",
      "解析或索引失败时文件进入 failed 状态，可在文件中心重新解析。",
    ],
  },
};

function runtimeSpecFor(skill: SkillRecord): SkillRuntimeSpec {
  const verified = verifiedRuntimeSpecs[skill.id];
  if (verified) return verified;
  return {
    level: "adapter",
    badge: "Adapter 待绑定",
    engine: "技能契约已持久化 · 暂无专用执行器",
    summary: "可以创建任务、绑定文件并生成计划；进入专用计算前会明确阻止，不会返回伪造结果。",
    binding: "通用任务与计划 API；专用 executor 尚未配置",
    scenarios: [
      skill.description,
      `围绕 ${skill.inputs.join("、")} 组织输入`,
      `按 ${skill.outputs.join("、")} 定义交付`,
    ],
    dependencies: skill.inputs.map((item) => `${item}：运行前需要绑定并通过格式校验`),
    boundaries: [
      "当前版本没有该技能的专用计算器或外部工具绑定",
      "任务创建不代表真实计算能力已经就绪",
      "接入执行器前只提供契约、计划和文件上下文管理",
    ],
    parameters: skill.inputs.map((item) => ({ name: item, value: "由任务配置或项目文件提供" })),
    steps: [
      { title: "读取契约", detail: "确认技能版本、输入、输出与执行说明。" },
      { title: "绑定上下文", detail: "选择项目文件并补充任务所需参数。" },
      { title: "生成计划", detail: "智能体基于契约生成可审批步骤，不生成分析结果。" },
      { title: "等待执行器", detail: "专用 Adapter 接入后才能执行真实计算或外部调用。" },
    ],
    fallback: [
      "未绑定执行器时在运行前返回明确错误，不降级为随机或固定结果。",
      "技能说明仍可用于计划生成、输入检查和后续 Adapter 开发。",
    ],
  };
}

function instructionSegments(skill: SkillRecord, spec: SkillRuntimeSpec) {
  const customSections = (skill.instructions ?? "")
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);
  if (customSections.length) {
    return customSections.map((section, index) => {
      const [firstLine, ...rest] = section.split("\n");
      return {
        title: rest.length ? firstLine.replace(/^#+\s*/, "") : `执行说明 ${index + 1}`,
        detail: rest.length ? rest.join("\n") : firstLine,
      };
    });
  }
  return [
    { title: "能力目标", detail: skill.description },
    { title: "运行实现", detail: `${spec.engine}\n${spec.summary}` },
    { title: "输入要求", detail: spec.dependencies.join("\n") },
    { title: "安全边界", detail: spec.boundaries.join("\n") },
  ];
}

function SkillFilters({
  query,
  source,
  category,
  availability,
  categories,
  onQueryChange,
  onSourceChange,
  onCategoryChange,
  onAvailabilityChange,
}: {
  query: string;
  source: string;
  category: string;
  availability: string;
  categories: string[];
  onQueryChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onAvailabilityChange: (value: string) => void;
}) {
  return (
    <section className="catalog-toolbar">
      <CatalogSearch
        value={query}
        onChange={onQueryChange}
        placeholder="搜索技能名称、用途或输入…"
        ariaLabel="技能"
      />
      <div className="filter-row mui-filter-row">
        <ToggleButtonGroup
          exclusive
          value={source}
          onChange={(_, value) => value && onSourceChange(value)}
          size="small"
          aria-label="技能来源"
          className="catalog-toggle-group"
        >
          {sources.map((item) => (
            <ToggleButton key={item} value={item} aria-label={item}>
              {item}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <div className="catalog-selects">
          <SelectControl
            value={availability}
            onChange={(event) => onAvailabilityChange(event.target.value)}
            aria-label="技能状态"
          >
            {availabilityOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SelectControl>
          <SelectControl
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
            aria-label="技能分类"
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SelectControl>
        </div>
      </div>
    </section>
  );
}

function SkillCard({
  skill,
  busy,
  onToggle,
  onDelete,
}: {
  skill: SkillRecord;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="skill-card">
      <header className="skill-card-top">
        <div className="skill-card-heading">
          <span className="skill-glyph">
            <ScienceOutlined sx={{ fontSize: 18 }} />
          </span>
          <div>
            <span className="skill-category">{skill.category}</span>
            <h2>
              <Link className="skill-card-link" href={`/skills/${skill.id}`}>
                {skill.name}
              </Link>
            </h2>
          </div>
        </div>
        <Chip
          className={`skill-state ${skill.enabled ? "enabled" : ""}`}
          size="small"
          label={skill.enabled ? "已启用" : "可用"}
          variant={skill.enabled ? "filled" : "outlined"}
        />
      </header>
      <div className="skill-card-body">
        <p>{skill.description}</p>
        <dl className="skill-contract">
          <div>
            <dt>输入</dt>
            <dd>{skill.inputs.slice(0, 2).join(" · ")}</dd>
          </div>
          <div>
            <dt>产出</dt>
            <dd>{skill.outputs.slice(0, 2).join(" · ")}</dd>
          </div>
        </dl>
      </div>
      <footer>
        <small>
          {skill.source} · v{skill.version}
        </small>
        <div className="skill-card-actions">
          <Button className="text-button" size="small" disabled={busy} onClick={onToggle}>
            {busy && <CircularProgress size={12} sx={{ mr: 0.6 }} />}
            {busy ? "保存中" : skill.enabled ? "停用" : "启用"}
          </Button>
          <Tooltip title="查看技能详情">
            <IconButton
              className="skill-open-button"
              component={Link}
              href={`/skills/${skill.id}`}
              size="small"
              aria-label={`查看${skill.name}详情`}
            >
              <ArrowOutwardRounded sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="删除技能">
            <IconButton
              className="skill-delete-button"
              size="small"
              disabled={busy}
              aria-label={`删除${skill.name}`}
              onClick={onDelete}
            >
              <DeleteOutlineRounded sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </div>
      </footer>
    </article>
  );
}

export function SkillCatalog() {
  const router = useRouter();
  const catalogRef = useRef<HTMLElement>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    category: "转录组",
    description: "",
    inputs: "",
    outputs: "",
    instructions: "",
  });
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("全部来源");
  const [category, setCategory] = useState("全部分类");
  const [availability, setAvailability] = useState("全部状态");
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busySkillId, setBusySkillId] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SkillRecord | null>(null);
  const [deletingSkillId, setDeletingSkillId] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await bioflowApi.listSkills({
        search: query,
        source,
        category,
        availability,
        page: String(page),
        pageSize,
      });
      setSkills(response.items);
      setTotal(response.total);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "能力目录加载失败"));
    } finally {
      setLoading(false);
    }
  }, [availability, category, page, pageSize, query, source]);

  useEffect(() => {
    const catalog = catalogRef.current;
    const viewport = catalog?.closest<HTMLElement>(".module-content");
    if (!catalog || !viewport) return;
    let frame = 0;
    const updatePageSize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const style = window.getComputedStyle(catalog);
        const contentWidth =
          catalog.clientWidth -
          Number.parseFloat(style.paddingLeft) -
          Number.parseFloat(style.paddingRight);
        const stickyHeight =
          catalog.querySelector<HTMLElement>(".catalog-sticky")?.offsetHeight ?? 170;
        const columns = Math.max(1, Math.floor((contentWidth + 9) / (228 + 9)));
        const availableGridHeight = Math.max(188, viewport.clientHeight - stickyHeight - 112);
        const rows = Math.max(1, Math.min(3, Math.floor((availableGridHeight + 9) / (188 + 9))));
        const next = Math.max(1, Math.min(12, columns * rows));
        setPageSize((current) => {
          if (current === next) return current;
          setPage(1);
          return next;
        });
      });
    };
    const observer = new ResizeObserver(updatePageSize);
    observer.observe(catalog);
    observer.observe(viewport);
    updatePageSize();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSkills(), 180);
    return () => window.clearTimeout(timer);
  }, [loadSkills]);

  const categories = useMemo(
    () => ["全部分类", "转录组", "智能体基础", "单细胞", "结构生物学", "基因组"],
    [],
  );

  const toggleSkill = async (skill: SkillRecord) => {
    setBusySkillId(skill.id);
    try {
      const response = await bioflowApi.setSkillEnabled(skill.id, !skill.enabled);
      setSkills((items) => items.map((item) => (item.id === skill.id ? response.skill : item)));
    } catch (toggleError) {
      setError(getApiErrorMessage(toggleError, "技能状态保存失败"));
    } finally {
      setBusySkillId("");
    }
  };

  const deleteSkill = async (skill: SkillRecord) => {
    setDeletingSkillId(skill.id);
    setDeleteError("");
    try {
      const result = await bioflowApi.deleteSkill(skill.id);
      setPendingDelete(null);
      setSkills((items) => items.filter((item) => item.id !== skill.id));
      setTotal((current) => Math.max(0, current - 1));
      if (skills.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        void loadSkills();
      }
      setError("");
      return result;
    } catch (deleteSkillError) {
      setDeleteError(getApiErrorMessage(deleteSkillError, "技能删除失败"));
      return undefined;
    } finally {
      setDeletingSkillId("");
    }
  };

  return (
    <main className="catalog-page" ref={catalogRef}>
      <div className="catalog-sticky">
        <header className="catalog-header">
          <h1>能力中心</h1>
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            className="primary"
            onClick={() => {
              setCreateError("");
              setCreating(true);
            }}
          >
            新建技能
          </Button>
        </header>
        <SkillFilters
          query={query}
          source={source}
          category={category}
          availability={availability}
          categories={categories}
          onQueryChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          onSourceChange={(value) => {
            setSource(value);
            setPage(1);
          }}
          onCategoryChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
          onAvailabilityChange={(value) => {
            setAvailability(value);
            setPage(1);
          }}
        />
      </div>
      {loading && <ResourceLoading variant="skills" label="正在读取能力目录" />}
      {error && (
        <section className="catalog-state error">
          <span>{error}</span>
          <button onClick={() => void loadSkills()}>重新加载</button>
        </section>
      )}
      {!loading && !error && skills.length === 0 && (
        <section className="catalog-state">没有匹配的技能，请调整筛选条件。</section>
      )}
      {!loading && !error && (
        <section className="skill-grid">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              busy={busySkillId === skill.id || deletingSkillId === skill.id}
              onToggle={() => void toggleSkill(skill)}
              onDelete={() => {
                setDeleteError("");
                setPendingDelete(skill);
              }}
            />
          ))}
        </section>
      )}
      <section className="catalog-meta">
        <span>{total} 个技能</span>
        <small>服务端目录快照 · 状态跨刷新持久化 · 运行前可审计版本</small>
      </section>
      <CatalogPagination
        page={page}
        count={Math.max(1, Math.ceil(total / pageSize))}
        label="能力目录分页"
        onChange={setPage}
      />
      <ResponsiveDialog
        open={creating}
        title="新建技能"
        eyebrow="能力配置"
        busy={saving}
        onClose={() => setCreating(false)}
      >
        <form
          className="skill-create-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setCreateError("");
            try {
              const response = await bioflowApi.createSkill(draft);
              router.push(`/skills/${response.skill.id}`);
            } catch (error) {
              setCreateError(getApiErrorMessage(error, "创建失败"));
            } finally {
              setSaving(false);
            }
          }}
        >
          {(
            [
              ["name", "技能名称"],
              ["category", "分类"],
              ["description", "用途"],
              ["inputs", "输入（逗号分隔）"],
              ["outputs", "输出（逗号分隔）"],
              ["instructions", "执行说明"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              {key === "instructions" ? (
                <textarea
                  required
                  maxLength={8000}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              ) : (
                <input
                  required
                  maxLength={key === "name" ? 80 : key === "category" ? 40 : 1000}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              )}
            </label>
          ))}
          {createError && <p role="alert">{createError}</p>}
          <Button type="submit" variant="contained" disabled={saving}>
            {saving && <CircularProgress size={14} color="inherit" sx={{ mr: 0.8 }} />}
            {saving ? "创建中…" : "保存技能"}
          </Button>
        </form>
      </ResponsiveDialog>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`删除技能“${pendingDelete?.name || ""}”？`}
        description="自建技能会从当前工作区彻底删除；预置或共享技能会从当前工作区目录移除，不会破坏系统原始能力。"
        busy={Boolean(deletingSkillId)}
        error={deleteError}
        onClose={() => {
          if (deletingSkillId) return;
          setDeleteError("");
          setPendingDelete(null);
        }}
        onConfirm={() => {
          if (!pendingDelete || deletingSkillId) return;
          void deleteSkill(pendingDelete);
        }}
      />
    </main>
  );
}

export function SkillDetail({ skillId }: { skillId: string }) {
  const router = useRouter();
  const [applying, setApplying] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [skill, setSkill] = useState<SkillRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "segments">("overview");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setSkill((await bioflowApi.getSkill(skillId)).skill);
      } catch (loadError) {
        setError(getApiErrorMessage(loadError, "技能详情加载失败"));
      }
    })();
  }, [skillId]);

  if (error)
    return (
      <main className="detail-page skill-detail-page">
        <section className="catalog-state error">
          <span>{error}</span>
          <Button size="small" component={Link} href="/skills">
            返回能力中心
          </Button>
        </section>
      </main>
    );
  if (!skill)
    return (
      <main className="detail-page skill-detail-page">
        <ResourceLoading variant="skills" label="正在读取技能契约" />
      </main>
    );

  const spec = runtimeSpecFor(skill);
  const segments = instructionSegments(skill, spec);
  const updatedAt = new Date(skill.updatedAt).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const toggleSkill = async () => {
    setToggling(true);
    setApplyError("");
    try {
      const response = await bioflowApi.setSkillEnabled(skill.id, !skill.enabled);
      setSkill(response.skill);
    } catch (toggleError) {
      setApplyError(getApiErrorMessage(toggleError, "技能状态保存失败"));
    } finally {
      setToggling(false);
    }
  };

  const applySkill = async () => {
    setApplying(true);
    setApplyError("");
    try {
      if (!skill.enabled) {
        const response = await bioflowApi.setSkillEnabled(skill.id, true);
        setSkill(response.skill);
      }
      const response = await bioflowApi.createTask(skill.name, { skillId: skill.id });
      router.push(`/projects/proj_a5211690a4/tasks/${response.task.id}`);
    } catch (applyTaskError) {
      setApplyError(getApiErrorMessage(applyTaskError, "应用技能失败"));
      setApplying(false);
    }
  };

  return (
    <main className="detail-page skill-detail-page">
      <header className="skill-detail-toolbar">
        <Button
          component={Link}
          href="/skills"
          size="small"
          startIcon={<ArrowBackRounded />}
          className="skill-detail-back"
        >
          能力中心
        </Button>
        <span>技能契约与运行边界</span>
      </header>

      <section className="skill-detail-hero">
        <div className="skill-detail-identity">
          <span className="skill-detail-glyph" aria-hidden="true">
            <ScienceOutlined sx={{ fontSize: 26 }} />
          </span>
          <div>
            <div className="skill-detail-badges">
              <Chip size="small" label={skill.category} variant="outlined" />
              <Chip
                size="small"
                className={`skill-runtime-chip ${spec.level}`}
                icon={
                  spec.level === "verified" ? (
                    <CheckCircleOutlineRounded />
                  ) : (
                    <WarningAmberRounded />
                  )
                }
                label={spec.badge}
              />
            </div>
            <h1>{skill.name}</h1>
            <p>{skill.description}</p>
          </div>
        </div>
        <div className="skill-detail-meta" aria-label="技能版本信息">
          <span>
            <small>来源</small>
            <b>{skill.source}</b>
          </span>
          <span>
            <small>版本</small>
            <b>v{skill.version}</b>
          </span>
          <span>
            <small>更新时间</small>
            <b>{updatedAt}</b>
          </span>
        </div>
        <div className="skill-detail-actions">
          <Button
            variant="outlined"
            disabled={toggling || applying}
            onClick={() => void toggleSkill()}
          >
            {toggling && <CircularProgress size={13} sx={{ mr: 0.7 }} />}
            {toggling ? "保存中" : skill.enabled ? "停用技能" : "启用技能"}
          </Button>
          <Button
            variant="contained"
            startIcon={
              applying ? <CircularProgress size={14} color="inherit" /> : <PlayArrowRounded />
            }
            disabled={applying || toggling}
            onClick={() => void applySkill()}
          >
            {applying ? "创建任务中" : skill.enabled ? "使用技能创建任务" : "启用并创建任务"}
          </Button>
        </div>
      </section>

      <section className="skill-detail-tabs">
        <Tabs
          value={activeTab}
          onChange={(_, value: "overview" | "segments") => setActiveTab(value)}
          aria-label="技能详情视图"
        >
          <Tab value="overview" icon={<HubOutlined />} iconPosition="start" label="总览" />
          <Tab
            value="segments"
            icon={<DescriptionOutlined />}
            iconPosition="start"
            label="分段解析"
          />
        </Tabs>
      </section>

      {activeTab === "overview" ? (
        <section className="skill-overview" aria-label="技能总览">
          <div className="skill-overview-primary">
            <article className="skill-detail-section skill-scenarios">
              <header>
                <span className="skill-section-icon">
                  <SettingsSuggestRounded />
                </span>
                <div>
                  <small>适用场景</small>
                  <h2>这个技能能解决什么</h2>
                </div>
              </header>
              <ul>
                {spec.scenarios.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="skill-detail-section skill-contract-panel">
              <header>
                <span className="skill-section-icon">
                  <DataObjectRounded />
                </span>
                <div>
                  <small>数据契约</small>
                  <h2>运行前后会交换什么</h2>
                </div>
              </header>
              <div className="skill-contract-columns">
                <section>
                  <h3>
                    <DataObjectRounded /> 输入
                  </h3>
                  {skill.inputs.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </section>
                <section>
                  <h3>
                    <OutputRounded /> 输出
                  </h3>
                  {skill.outputs.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </section>
              </div>
            </article>
          </div>

          <aside className="skill-runtime-panel">
            <header>
              <small>当前项目绑定</small>
              <h2>{spec.badge}</h2>
            </header>
            <p>{spec.summary}</p>
            <dl>
              <div>
                <dt>执行引擎</dt>
                <dd>{spec.engine}</dd>
              </div>
              <div>
                <dt>接口绑定</dt>
                <dd>
                  <code>{spec.binding}</code>
                </dd>
              </div>
              <div>
                <dt>启用状态</dt>
                <dd>{skill.enabled ? "已启用，可由智能体选择" : "未启用，不参与智能体调度"}</dd>
              </div>
            </dl>
          </aside>

          <article className="skill-detail-section skill-requirements">
            <header>
              <span className="skill-section-icon">
                <CheckCircleOutlineRounded />
              </span>
              <div>
                <small>运行准备</small>
                <h2>依赖与输入检查</h2>
              </div>
            </header>
            <ul>
              {spec.dependencies.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="skill-detail-section skill-boundaries">
            <header>
              <span className="skill-section-icon">
                <SecurityRounded />
              </span>
              <div>
                <small>可信边界</small>
                <h2>不会被包装成真实能力的部分</h2>
              </div>
            </header>
            <ul>
              {spec.boundaries.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>
      ) : (
        <section className="skill-segment-view" aria-label="技能分段解析">
          <aside className="skill-segment-index">
            <small>本地技能说明</small>
            <h2>{segments.length} 个语义段</h2>
            <ol>
              {segments.map((segment, index) => (
                <li key={`${segment.title}-${index}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {segment.title}
                </li>
              ))}
            </ol>
          </aside>
          <div className="skill-segment-content">
            {spec.level === "adapter" && (
              <Alert severity="warning" variant="outlined">
                当前仅有技能契约和执行说明，专用 Adapter 尚未绑定；页面不会展示虚假的运行结果。
              </Alert>
            )}
            <section className="skill-segment-doc">
              {segments.map((segment, index) => (
                <article key={`${segment.title}-${index}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h2>{segment.title}</h2>
                    {segment.detail.split("\n").map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </article>
              ))}
            </section>

            <section className="skill-parameter-section">
              <header>
                <small>参数契约</small>
                <h2>运行参数与默认策略</h2>
              </header>
              <dl>
                {spec.parameters.map((parameter) => (
                  <div key={parameter.name}>
                    <dt>{parameter.name}</dt>
                    <dd>{parameter.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="skill-execution-section">
              <header>
                <small>执行步骤</small>
                <h2>从输入到交付</h2>
              </header>
              <ol>
                {spec.steps.map((step, index) => (
                  <li key={step.title}>
                    <span>{index + 1}</span>
                    <div>
                      <b>{step.title}</b>
                      <p>{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="skill-fallback-section">
              <header>
                <small>失败与降级</small>
                <h2>异常时系统怎么处理</h2>
              </header>
              <ul>
                {spec.fallback.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>
        </section>
      )}

      {/* <footer className="skill-detail-footer">
        <span>
          <b>{skill.enabled ? "技能已启用" : "技能未启用"}</b>
          <small>{spec.level === "verified" ? spec.badge : "创建任务后仍需绑定专用执行器"}</small>
        </span>
        <Button
          variant="contained"
          startIcon={
            applying ? <CircularProgress size={14} color="inherit" /> : <PlayArrowRounded />
          }
          disabled={applying || toggling}
          onClick={() => void applySkill()}
        >
          {applying ? "创建任务中" : skill.enabled ? "创建任务" : "启用并创建任务"}
        </Button>
      </footer> */}
      {applyError && (
        <Alert className="skill-detail-error" severity="error" onClose={() => setApplyError("")}>
          {applyError}
        </Alert>
      )}
    </main>
  );
}
