"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { bioflowApi, getApiErrorMessage } from "@/lib/api-client";
import type { SkillRecord } from "@/lib/domain";
import { CatalogSearch } from "./ui/CatalogSearch";
import { SelectControl } from "./ui/SelectControl";

const sources = ["全部来源", "BioFlow Lab", "Team", "Community", "Mine"];
const pageSize = 6;

function SkillFilters({
  query,
  source,
  category,
  categories,
  onQueryChange,
  onSourceChange,
  onCategoryChange,
}: {
  query: string;
  source: string;
  category: string;
  categories: string[];
  onQueryChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
}) {
  return (
    <section className="catalog-toolbar">
      <CatalogSearch
        value={query}
        onChange={onQueryChange}
        placeholder="搜索技能名称、用途或输入…"
        ariaLabel="技能"
      />
      <div className="filter-row">
        {sources.map((item) => (
          <button
            key={item}
            className={source === item ? "active" : ""}
            onClick={() => onSourceChange(item)}
          >
            {item}
          </button>
        ))}
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
      <div className="skill-card-top">
        <span className="skill-glyph">◇</span>
        <span className={`skill-state ${skill.enabled ? "enabled" : ""}`}>
          {skill.enabled ? "已启用" : "可用"}
        </span>
      </div>
      <div className="skill-card-body">
        <span className="skill-category">{skill.category}</span>
        <h2>
          <Link className="skill-card-link" href={`/skills/${skill.id}`}>
            {skill.name}
          </Link>
        </h2>
        <p>{skill.description}</p>
        <div className="skill-io">
          <span>输入：{skill.inputs.join(" · ")}</span>
          <span>输出：{skill.outputs.join(" · ")}</span>
        </div>
      </div>
      <footer>
        <small>
          {skill.source} · v{skill.version} ·{" "}
          {new Date(skill.updatedAt).toLocaleDateString("zh-CN")}
        </small>
        <div>
          <button className="text-button" disabled={busy} onClick={onToggle}>
            {busy ? "保存中…" : skill.enabled ? "停用" : "启用"}
          </button>
          <Link className="text-button" href={`/skills/${skill.id}`}>
            查看详情 →
          </Link>
        </div>
      </footer>
    </article>
  );
}

export function SkillCatalog() {
  const router = useRouter();
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
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busySkillId, setBusySkillId] = useState("");

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await bioflowApi.login();
      const response = await bioflowApi.listSkills({
        search: query,
        source,
        category,
        page: String(page),
      });
      setSkills(response.items);
      setTotal(response.total);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "能力目录加载失败"));
    } finally {
      setLoading(false);
    }
  }, [category, query, source, page]);

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
    <main className="catalog-page">
      <div className="catalog-sticky">
        <header className="catalog-header">
          <div>
            <Link href="/projects/proj_a5211690a4/tasks/task_demo_rnaseq" className="back-link">
              ← 返回工作台
            </Link>
            <span className="catalog-kicker">SKILL HUB / 能力中心</span>
            <h1>能力中心</h1>
          </div>
          <button
            className="primary"
            onClick={() => {
              setCreateError("");
              setCreating(true);
            }}
          >
            ＋ 新建技能
          </button>
        </header>
        <SkillFilters
          query={query}
          source={source}
          category={category}
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
        />
      </div>
      <section className="catalog-meta">
        <span>{total} 个技能</span>
        <small>服务端目录快照 · 状态跨刷新持久化 · 运行前可审计版本</small>
      </section>
      {loading && <section className="catalog-state">正在读取能力目录…</section>}
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
      {total > pageSize && (
        <nav className="catalog-pagination" aria-label="能力目录分页">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            上一页
          </button>
          {Array.from({ length: Math.ceil(total / pageSize) }, (_, index) => index + 1).map(
            (pageNumber) => (
              <button
                className={page === pageNumber ? "current" : ""}
                aria-current={page === pageNumber ? "page" : undefined}
                key={pageNumber}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ),
          )}
          <button disabled={page * pageSize >= total} onClick={() => setPage(page + 1)}>
            下一页
          </button>
        </nav>
      )}
      {creating && (
        <div className="ui-modal-backdrop" onMouseDown={() => !saving && setCreating(false)}>
          <section
            className="ui-modal"
            role="dialog"
            aria-modal="true"
            aria-label="新建技能"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <h2>新建技能</h2>
              <button
                aria-label="关闭新建技能"
                disabled={saving}
                onClick={() => setCreating(false)}
              >
                ×
              </button>
            </header>
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
              <button className="primary" disabled={saving}>
                {saving ? "创建中…" : "保存技能"}
              </button>
            </form>
          </section>
        </div>
      )}
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
        await bioflowApi.login();
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
