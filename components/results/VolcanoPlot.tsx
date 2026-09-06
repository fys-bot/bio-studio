"use client";

import { useState } from "react";
import type { CandidateGene } from "@/lib/domain";

type VolcanoPlotProps = {
  genes: CandidateGene[];
  selectedGeneSymbol: string | null;
  onSelectGene: (geneSymbol: string) => void;
};

/**
 * 可访问的交互式火山图。候选点坐标来自运行结果，背景点仅用于表达总体分布。
 * 鼠标、触控和键盘共享同一个选中状态，方便在面试演示中呈现图表联动能力。
 */
export function VolcanoPlot({
  genes,
  selectedGeneSymbol,
  onSelectGene,
}: VolcanoPlotProps) {
  const [hoveredGeneSymbol, setHoveredGeneSymbol] = useState<string | null>(null);
  const activeGene = genes.find(
    (gene) => gene.symbol === (hoveredGeneSymbol || selectedGeneSymbol),
  );

  return (
    <div className="volcano-shell">
      <svg
        className="volcano"
        viewBox="0 0 280 220"
        role="img"
        aria-label="差异表达火山图，可点击候选基因查看统计详情"
      >
        <line className="volcano-axis" x1="32" y1="190" x2="265" y2="190" />
        <line className="volcano-axis" x1="32" y1="20" x2="32" y2="190" />
        <line className="volcano-threshold" x1="32" y1="118" x2="265" y2="118" />
        <line className="volcano-threshold" x1="99" y1="20" x2="99" y2="190" />
        <line className="volcano-threshold" x1="180" y1="20" x2="180" y2="190" />
        <text className="volcano-axis-label" x="126" y="211">
          log₂ 倍数变化
        </text>
        <text className="volcano-axis-label" x="6" y="18">
          −log₁₀ FDR
        </text>

        {Array.from({ length: 55 }, (_, pointIndex) => (
          <circle
            key={pointIndex}
            cx={45 + ((pointIndex * 47) % 205)}
            cy={178 - ((pointIndex * 29) % 64)}
            r={2}
            className="volcano-background-point"
          />
        ))}

        {genes.map((gene) => {
          const isActive = activeGene?.symbol === gene.symbol;
          return (
            <g
              key={gene.symbol}
              className={`volcano-gene-point ${gene.direction} ${
                isActive ? "active" : ""
              }`}
              role="button"
              tabIndex={0}
              aria-label={`${gene.symbol}，FDR ${gene.fdr}，log2 倍数变化 ${gene.log2FoldChange}`}
              onClick={() => onSelectGene(gene.symbol)}
              onFocus={() => setHoveredGeneSymbol(gene.symbol)}
              onBlur={() => setHoveredGeneSymbol(null)}
              onMouseEnter={() => setHoveredGeneSymbol(gene.symbol)}
              onMouseLeave={() => setHoveredGeneSymbol(null)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectGene(gene.symbol);
                }
              }}
            >
              <circle cx={gene.plotX} cy={gene.plotY} r={isActive ? 6 : 4} />
              {isActive && (
                <text
                  className="volcano-gene-label"
                  x={gene.plotX > 210 ? gene.plotX - 8 : gene.plotX + 8}
                  y={gene.plotY - 8}
                  textAnchor={gene.plotX > 210 ? "end" : "start"}
                >
                  {gene.symbol}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="volcano-legend" aria-hidden="true">
        <span><i className="up" />上调</span>
        <span><i className="down" />下调</span>
        <span><i className="background" />未显著</span>
      </div>

      {activeGene && (
        <div className="gene-detail" role="status">
          <span className={`gene-direction ${activeGene.direction}`}>
            {activeGene.direction === "up" ? "上调" : "下调"}
          </span>
          <b>{activeGene.symbol}</b>
          <span>FDR {activeGene.fdr}</span>
          <span>log₂FC {activeGene.log2FoldChange > 0 ? "+" : ""}{activeGene.log2FoldChange}</span>
        </div>
      )}
    </div>
  );
}
