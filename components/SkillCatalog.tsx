"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import ScienceOutlined from "@mui/icons-material/ScienceOutlined";
import {
  Button,
  Chip,
  CircularProgress,
  IconButton,
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
import { ResourceLoading } from "./ui/ResourceLoading";
import { ResponsiveDialog } from "./ui/ResponsiveDialog";
import { SelectControl } from "./ui/SelectControl";

const sources = ["全部来源", "BioFlow Lab", "Team", "Community", "Mine"];
const availabilityOptions = ["全部状态", "已启用", "可用"];

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
}: {
  skill: SkillRecord;
  busy: boolean;
  onToggle: () => void;
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
              busy={busySkillId === skill.id}
              onToggle={() => void toggleSkill(skill)}
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
    </main>
  );
}

export function SkillDetail({ skillId }: { skillId: string }) {
  const router = useRouter();
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [skill, setSkill] = useState<SkillRecord | null>(null);
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
      <main className="detail-page">
        <section className="catalog-state error">{error}</section>
      </main>
    );
  if (!skill)
    return (
      <main className="detail-page">
        <section className="catalog-state">正在加载技能契约…</section>
      </main>
    );
  return (
    <main className="detail-page">
      <Link href="/skills" className="back-link">
        ← 返回能力中心
      </Link>
      <div className="detail-hero">
        <span className="skill-glyph">◇</span>
        <span className="skill-category">
          {skill.category} · {skill.source} · v{skill.version}
        </span>
        <h1>{skill.name}</h1>
        <p>{skill.description}</p>
      </div>
      <div className="detail-grid">
        <section>
          <h2>输入契约</h2>
          {skill.inputs.map((item) => (
            <div className="contract-row" key={item}>
              <b>✓</b>
              <span>{item}</span>
            </div>
          ))}
        </section>
        <section>
          <h2>输出契约</h2>
          {skill.outputs.map((item) => (
            <div className="contract-row" key={item}>
              <b>→</b>
              <span>{item}</span>
            </div>
          ))}
        </section>
        <section>
          <h2>运行绑定</h2>
          <p>
            {skill.id === "rnaseq-deseq2"
              ? "PyDESeq2 0.5.4 · 异步统计计算"
              : skill.id === "rag-evidence"
                ? "真实文档解析 · Qdrant · BM25 / RRF"
                : "配置已保存 · 尚未绑定专用计算器"}
          </p>
        </section>
      </div>
      {skill.instructions && (
        <section className="skill-instructions">
          <h2>执行说明</h2>
          <p>{skill.instructions}</p>
        </section>
      )}
      <button
        className="primary detail-cta"
        disabled={applying}
        onClick={async () => {
          setApplying(true);
          setApplyError("");
          try {
            if (!skill.enabled) await bioflowApi.setSkillEnabled(skill.id, true);
            const response = await bioflowApi.createTask(skill.name, { skillId: skill.id });
            router.push(`/projects/proj_a5211690a4/tasks/${response.task.id}`);
          } catch (error) {
            setApplyError(getApiErrorMessage(error, "应用技能失败"));
            setApplying(false);
          }
        }}
      >
        {applying ? "创建任务中…" : "使用此技能创建任务"}
      </button>
      {applyError && <p role="alert">{applyError}</p>}
    </main>
  );
}
