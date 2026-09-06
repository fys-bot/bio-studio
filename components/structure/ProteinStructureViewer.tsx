"use client";

import { useMemo, useState } from "react";
import { useProteinStructureRenderer } from "@/components/structure/useProteinStructureRenderer";
import type { CandidateGene } from "@/lib/domain";
import {
  getStructureMetadata,
  structurePoints,
} from "@/lib/structure-model";

type ProteinStructureViewerProps = {
  gene?: CandidateGene;
  selectedResidue: number | null;
  onSelectResidue: (residueNumber: number) => void;
  onOpenMolstar: () => void;
};

/**
 * 蛋白质结构业务面板：组合三维渲染适配器、结构元数据和差异表达结果。
 * 该层不实现坐标数学，便于后续把轻量 Canvas 适配器替换为 Mol*。
 */
export function ProteinStructureViewer({
  gene,
  selectedResidue,
  onSelectResidue,
  onOpenMolstar,
}: ProteinStructureViewerProps) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [hoveredResidue, setHoveredResidue] = useState<number | null>(null);
  const structure = getStructureMetadata(gene?.symbol);
  const selectedPoint = useMemo(
    () =>
      structurePoints.find((point) => point.residueNumber === selectedResidue) ||
      structurePoints.find((point) => point.residueNumber === hoveredResidue),
    [hoveredResidue, selectedResidue],
  );
  const renderer = useProteinStructureRenderer({
    autoRotate,
    hoveredResidue,
    selectedResidue,
    onHoverResidue: setHoveredResidue,
    onSelectResidue,
  });

  return (
    <div className="structure-view">
      <div className="structure-toolbar">
        <div>
          <small>AlphaFold DB · {structure.accession}</small>
          <b>{gene?.symbol || "E2F1"} 三维结构</b>
        </div>
        <div>
          <button onClick={() => setAutoRotate((current) => !current)}>
            {autoRotate ? "暂停旋转" : "自动旋转"}
          </button>
          <button onClick={renderer.resetView}>复位</button>
        </div>
      </div>

      <div className="protein-canvas-shell">
        <canvas
          ref={renderer.canvasRef}
          tabIndex={0}
          aria-label={`${structure.name} 三维结构，可拖拽旋转、滚轮缩放并点击残基`}
          onPointerDown={renderer.handlePointerDown}
          onPointerMove={renderer.handlePointerMove}
          onPointerUp={renderer.handlePointerUp}
          onPointerLeave={renderer.handlePointerLeave}
          onWheel={renderer.handleWheel}
        />
        <span className="structure-interaction-hint">
          拖拽旋转 · 滚轮缩放 · 点击残基
        </span>
        {selectedPoint && (
          <div className="residue-tooltip">
            <b>
              {selectedPoint.aminoAcid} {selectedPoint.residueNumber}
            </b>
            <span>pLDDT {selectedPoint.confidence}</span>
          </div>
        )}
      </div>

      <div className="structure-metrics">
        <div>
          <small>模型置信度</small>
          <b>{structure.confidence} pLDDT</b>
        </div>
        <div>
          <small>结构范围</small>
          <b>104–175 aa</b>
        </div>
        <div>
          <small>功能位点</small>
          <b>4 个</b>
        </div>
      </div>

      <section className="structure-context-card">
        <small>跨产物关联</small>
        <h3>{structure.name}</h3>
        {gene ? (
          <p>
            来自火山图候选基因 · FDR {gene.fdr} · log₂FC{" "}
            {gene.log2FoldChange > 0 ? "+" : ""}
            {gene.log2FoldChange}
          </p>
        ) : (
          <p>默认展示 E2F1；请先在结果面板选择候选基因以建立统计结果关联。</p>
        )}
        {selectedPoint && (
          <p className="selected-residue-summary">
            已选残基 {selectedPoint.aminoAcid} {selectedPoint.residueNumber}
            ，可继续关联文献和变异证据。
          </p>
        )}
      </section>

      <button className="secondary full" onClick={onOpenMolstar}>
        在 Mol* 中打开完整结构
      </button>
    </div>
  );
}
