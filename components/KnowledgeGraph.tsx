"use client";

import { useMemo, useState } from "react";

type EvidenceGroup = "项目文件" | "技能包" | "文献" | "知识图谱";

type EvidenceItem = {
  id: string;
  group: EvidenceGroup;
  title: string;
  detail: string;
  score: string;
  binding: string;
  input: string;
  output: string;
  impact: string;
};

type GraphNode = {
  id: string;
  label: string;
  type: "gene" | "pathway" | "paper" | "parameter";
  x: number;
  y: number;
};

const evidenceItems: EvidenceItem[] = [
  {
    id: "metadata",
    group: "项目文件",
    title: "sample_metadata.tsv",
    detail: "condition 字段 · 24 个样本 · schema 已校验",
    score: "0.98",
    binding: "绑定 design_formula",
    input: "样本分组、批次字段",
    output: "~ condition + batch",
    impact: "决定设计矩阵的列和对比方向",
  },
  {
    id: "deseq2",
    group: "技能包",
    title: "DESeq2 差异表达技能包",
    detail: "v2.1 · size factor + negative binomial",
    score: "0.96",
    binding: "绑定统计模型",
    input: "Count 矩阵、设计矩阵",
    output: "DESeqDataSet",
    impact: "决定归一化与显著性检验方法",
  },
  {
    id: "love2014",
    group: "文献",
    title: "Love et al. 2014 · Genome Biology",
    detail: "DESeq2 方法依据 · PMID 25516281",
    score: "0.91",
    binding: "绑定方法说明",
    input: "实验设计与统计假设",
    output: "可复现方法段落",
    impact: "为报告中的统计方法提供可追溯引用",
  },
  {
    id: "cell-cycle",
    group: "知识图谱",
    title: "处理组 → 细胞周期 → 候选基因",
    detail: "Reactome · TP53 / CDK1 / CCNB1",
    score: "0.87",
    binding: "绑定候选基因排序",
    input: "显著差异基因、通路关系",
    output: "候选基因优先级",
    impact: "解释为什么这些基因进入结果摘要",
  },
];

const graphNodes: GraphNode[] = [
  { id: "condition", label: "处理组", type: "parameter", x: 42, y: 98 },
  { id: "design", label: "设计矩阵", type: "parameter", x: 136, y: 55 },
  { id: "deseq", label: "DESeq2", type: "parameter", x: 245, y: 98 },
  { id: "pathway", label: "细胞周期", type: "pathway", x: 350, y: 55 },
  { id: "gene", label: "候选基因", type: "gene", x: 350, y: 145 },
  { id: "paper", label: "文献依据", type: "paper", x: 245, y: 170 },
];

const graphEdges = [
  ["condition", "design"],
  ["design", "deseq"],
  ["deseq", "pathway"],
  ["deseq", "paper"],
  ["pathway", "gene"],
];

const nodeColor: Record<GraphNode["type"], string> = {
  gene: "#8e9a1e",
  pathway: "#6b9b8c",
  paper: "#9874b8",
  parameter: "#b77a42",
};

type KnowledgeGraphProps = {
  nodeLabel?: string;
};

/**
 * RAG 证据解释器：把检索来源、参数绑定和知识关系放在同一条可点击链路中。
 */
export function KnowledgeGraph({ nodeLabel = "当前节点" }: KnowledgeGraphProps) {
  const [selectedId, setSelectedId] = useState("metadata");
  const selected = useMemo(
    () =>
      evidenceItems.find((item) => item.id === selectedId) || evidenceItems[0],
    [selectedId],
  );
  const selectGraphEvidence = (id: string) => {
    setSelectedId(
      id === "gene" || id === "pathway"
        ? "cell-cycle"
        : id === "paper"
        ? "love2014"
        : id === "deseq"
        ? "deseq2"
        : "metadata",
    );
  };

  return (
    <section className="rag-explorer" aria-label="RAG 全链路与知识图谱">
      <div className="rag-heading">
        <div>
          <small>RAG 全链路</small>
          <b>证据如何影响 {nodeLabel}</b>
        </div>
        <span>{evidenceItems.length} 条绑定</span>
      </div>
      <div className="rag-groups">
        {(["项目文件", "技能包", "文献", "知识图谱"] as EvidenceGroup[]).map(
          (group) => (
            <div className="rag-group" key={group}>
              <small>{group}</small>
              {evidenceItems
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    className={`rag-source ${
                      selected.id === item.id ? "active" : ""
                    }`}
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="rag-source-icon">
                      {group === "知识图谱" ? "◇" : "↳"}
                    </span>
                    <span>
                      <b>{item.title}</b>
                      <em>
                        {item.score} · {item.binding}
                      </em>
                    </span>
                  </button>
                ))}
            </div>
          ),
        )}
      </div>
      <div className="rag-detail">
        <div className="rag-detail-head">
          <span>当前证据</span>
          <b>{selected.title}</b>
        </div>
        <p>{selected.detail}</p>
        <div className="rag-io">
          <div>
            <small>输入</small>
            <b>{selected.input}</b>
          </div>
          <div>
            <small>输出</small>
            <b>{selected.output}</b>
          </div>
          <div>
            <small>下一步影响</small>
            <b>{selected.impact}</b>
          </div>
        </div>
      </div>
      <div className="knowledge-graph">
        <div className="knowledge-graph-head">
          <span>知识图谱关系</span>
          <small>点击节点查看关系</small>
        </div>
        <div className="knowledge-graph-canvas">
          <svg
            viewBox="0 0 390 205"
            role="img"
            aria-label="基因、通路、文献与分析参数关系图"
          >
            {graphEdges.map(([from, to]) => {
              const source = graphNodes.find((node) => node.id === from)!;
              const target = graphNodes.find((node) => node.id === to)!;
              return (
                <line
                  key={`${from}-${to}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className="knowledge-edge"
                />
              );
            })}
            {graphNodes.map((node) => (
              <g
                key={node.id}
                className="knowledge-node"
                onClick={() => selectGraphEvidence(node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectGraphEvidence(node.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`查看${node.label}关系`}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="17"
                  fill={nodeColor[node.type]}
                />
                <text x={node.x} y={node.y + 3} textAnchor="middle">
                  {node.type === "gene"
                    ? "基"
                    : node.type === "pathway"
                    ? "通"
                    : node.type === "paper"
                    ? "文"
                    : "参"}
                </text>
                <text
                  className="knowledge-node-label"
                  x={node.x}
                  y={node.y + 31}
                  textAnchor="middle"
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}
