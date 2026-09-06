"use client";

import { useMemo, useState } from "react";
import type { ArtifactRecord } from "@/lib/domain";
import { ArtifactLineage } from "@/components/results/ArtifactLineage";
import { VolcanoPlot } from "@/components/results/VolcanoPlot";

type ResultsPanelProps = {
  artifacts: ArtifactRecord[];
  running: boolean;
  selectedGeneSymbol: string | null;
  onSelectGene: (geneSymbol: string) => void;
  onRunDemo: () => void;
  onDownloadVolcano: () => void;
  onDownloadReport: () => void;
  onOpenNode: (nodeId: string) => void;
  onOpenEvidence: (title: string, detail: string) => void;
};

const formatArtifactDate = (createdAt?: string) =>
  createdAt ? new Date(createdAt).toLocaleString("zh-CN") : "—";

/** 结果工作区：组合图表、候选基因、血缘和科研报告，保持检查器本身轻量。 */
export function ResultsPanel({
  artifacts,
  running,
  selectedGeneSymbol,
  onSelectGene,
  onRunDemo,
  onDownloadVolcano,
  onDownloadReport,
  onOpenNode,
  onOpenEvidence,
}: ResultsPanelProps) {
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const volcanoArtifact = artifacts.find((artifact) => artifact.kind === "chart");
  const reportArtifact = artifacts.find((artifact) => artifact.kind === "report");
  const candidateGenes = useMemo(
    () => volcanoArtifact?.candidateGenes || [],
    [volcanoArtifact],
  );

  if (!volcanoArtifact) {
    return (
      <div className="result-empty-state">
        <div className="result-empty-visual" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <small>等待分析产物</small>
        <h3>运行工作流后生成结果</h3>
        <p>火山图、候选基因、参数快照和结果血缘会在同一版本中生成。</p>
        <button className="primary" onClick={onRunDemo} disabled={running}>
          {running ? "工作流运行中…" : "运行工作流"}
        </button>
      </div>
    );
  }

  return (
    <div className="result-view">
      <div className="result-head">
        <div>
          <small>结果产物</small>
          <h3>差异表达火山图</h3>
        </div>
        <button onClick={onDownloadVolcano} aria-label="下载火山图 SVG">
          ↧ SVG
        </button>
      </div>
      <div className="artifact-meta">
        <span>版本 {volcanoArtifact.version}</span>
        <span>{formatArtifactDate(volcanoArtifact.createdAt)}</span>
        <span>来源：{volcanoArtifact.sourceNode}</span>
      </div>

      <VolcanoPlot
        genes={candidateGenes}
        selectedGeneSymbol={selectedGeneSymbol}
        onSelectGene={onSelectGene}
      />

      <div className="metrics">
        <div>
          <b>{volcanoArtifact.summary?.testedGeneCount.toLocaleString() || "—"}</b>
          <small>检测基因数</small>
        </div>
        <div>
          <b>{volcanoArtifact.summary?.significantGeneCount || "—"}</b>
          <small>显著差异</small>
        </div>
        <div>
          <b>{volcanoArtifact.summary?.candidateGeneCount || "—"}</b>
          <small>候选基因</small>
        </div>
      </div>

      <div className="candidate-list">
        <div className="candidate-list-head">
          <b>候选基因 Top 5</b>
          <small>点击联动图表</small>
        </div>
        {candidateGenes.map((gene) => (
          <button
            className={`candidate-row ${
              selectedGeneSymbol === gene.symbol ? "active" : ""
            }`}
            key={gene.symbol}
            onClick={() => onSelectGene(gene.symbol)}
          >
            <b>{gene.symbol}</b>
            <span>FDR {gene.fdr}</span>
            <em className={gene.direction}>
              {gene.log2FoldChange > 0 ? "+" : ""}{gene.log2FoldChange}
            </em>
          </button>
        ))}
      </div>

      <ArtifactLineage
        artifact={volcanoArtifact}
        onOpenNode={onOpenNode}
        onOpenEvidence={onOpenEvidence}
      />

      {reportArtifact && (
        <div className="report-artifact-card">
          <div>
            <b>Markdown 分析报告</b>
            <small>
              {reportArtifact.version} · {formatArtifactDate(reportArtifact.createdAt)}
            </small>
          </div>
          <div className="report-actions">
            <button onClick={() => setReportPreviewOpen((open) => !open)}>
              {reportPreviewOpen ? "收起预览" : "预览报告"}
            </button>
            <button onClick={onDownloadReport}>下载 .md</button>
          </div>
          {reportPreviewOpen && (
            <pre className="report-preview">{`# RNA-seq 候选基因分析报告

## 运行摘要

- 版本：${reportArtifact.version}
- 统计模型：DESeq2
- FDR 阈值：0.05
- 证据绑定：4 条

## 结果

共检验 ${volcanoArtifact.summary?.testedGeneCount.toLocaleString()} 个基因，筛选 ${volcanoArtifact.summary?.candidateGeneCount} 个候选基因。结果可追溯到输入、参数、方法与证据来源。
`}</pre>
          )}
        </div>
      )}
    </div>
  );
}
