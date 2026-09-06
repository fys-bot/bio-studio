"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Skill = {
  id: string;
  name: string;
  category: string;
  description: string;
  source: string;
  enabled: boolean;
  updatedAt: string;
  inputs: string[];
  outputs: string[];
};

const skills: Skill[] = [
  {
    id: "rnaseq-deseq2",
    name: "DESeq2 差异表达",
    category: "转录组",
    description: "从 Count 矩阵和样本元数据构建设计矩阵，完成差异表达与 FDR 校正。",
    source: "BioFlow Lab",
    enabled: true,
    updatedAt: "2026-09-01",
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
    updatedAt: "2026-08-28",
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
    updatedAt: "2026-08-20",
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
    updatedAt: "2026-08-15",
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
    updatedAt: "2026-08-04",
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
    updatedAt: "2026-07-30",
    inputs: ["VCF", "参考基因组"],
    outputs: ["注释表", "临床证据"],
  },
];

export function SkillCatalog() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("全部来源");
  const [category, setCategory] = useState("全部分类");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(skills.map((skill) => [skill.id, skill.enabled])),
  );
  const categories = ["全部分类", ...Array.from(new Set(skills.map((skill) => skill.category)))];
  const sources = ["全部来源", "BioFlow Lab", "Team", "Community", "Mine"];
  const visibleSkills = useMemo(
    () =>
      skills.filter((skill) => {
        const matchedQuery = `${skill.name} ${skill.description}`
          .toLowerCase()
          .includes(query.toLowerCase());
        return (
          matchedQuery &&
          (source === "全部来源" || source === skill.source) &&
          (category === "全部分类" || category === skill.category)
        );
      }),
    [category, query, source],
  );
  return (
    <main className="catalog-page">
      <header className="catalog-header">
        <div>
          <Link href="/" className="back-link">
            ← 返回工作台
          </Link>
          <span className="catalog-kicker">SKILL HUB / 能力中心</span>
          <h1>让智能体拥有可组合的科研能力</h1>
          <p>每个技能都是可配置、可审计的工具包，输入、输出和证据边界在运行前清晰可见。</p>
        </div>
        <button className="primary" onClick={() => alert("新建技能向导将在下一版本开放")}>
          ＋ 新建技能
        </button>
      </header>
      <section className="catalog-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索技能名称、用途或输入…"
          aria-label="搜索技能"
        />
        <div className="filter-row">
          {sources.map((item) => (
            <button
              key={item}
              className={source === item ? "active" : ""}
              onClick={() => setSource(item)}
            >
              {item}
            </button>
          ))}
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="技能分类"
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </section>
      <section className="catalog-meta">
        <span>{visibleSkills.length} 个技能</span>
        <small>启用状态会保存到当前浏览器会话 · 运行前可在 Trace 中审计工具版本</small>
      </section>
      <section className="skill-grid">
        {visibleSkills.map((skill) => (
          <article className="skill-card" key={skill.id}>
            <div className="skill-card-top">
              <span className="skill-glyph">◇</span>
              <span className={`skill-state ${enabled[skill.id] ? "enabled" : ""}`}>
                {enabled[skill.id] ? "已启用" : "可用"}
              </span>
            </div>
            <div className="skill-card-body">
              <span className="skill-category">{skill.category}</span>
              <h2>{skill.name}</h2>
              <p>{skill.description}</p>
              <div className="skill-io">
                <span>输入：{skill.inputs.join(" · ")}</span>
                <span>输出：{skill.outputs.join(" · ")}</span>
              </div>
            </div>
            <footer>
              <small>
                {skill.source} · 更新于 {skill.updatedAt}
              </small>
              <div>
                <button
                  className="text-button"
                  onClick={() =>
                    setEnabled((current) => ({ ...current, [skill.id]: !current[skill.id] }))
                  }
                >
                  {enabled[skill.id] ? "停用" : "启用"}
                </button>
                <Link className="text-button" href={`/skills/${skill.id}`}>
                  查看详情 →
                </Link>
              </div>
            </footer>
          </article>
        ))}
      </section>
    </main>
  );
}

export function SkillDetail({ skillId }: { skillId: string }) {
  const skill = skills.find((item) => item.id === skillId) ?? skills[0];
  return (
    <main className="detail-page">
      <Link href="/skills" className="back-link">
        ← 返回能力中心
      </Link>
      <div className="detail-hero">
        <span className="skill-glyph">◇</span>
        <span className="skill-category">
          {skill.category} · {skill.source}
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
          <h2>可审计阶段</h2>
          <p>解析 → 切分 → 召回 Top 20 → 精排 → grounding → 工具调用 → Artifact 血缘</p>
        </section>
      </div>
      <Link href="/projects/proj_a5211690a4/tasks/task_demo_rnaseq" className="primary detail-cta">
        在演示任务中使用
      </Link>
    </main>
  );
}
