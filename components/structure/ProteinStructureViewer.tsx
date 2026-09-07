"use client";

import { useEffect, useMemo, useState } from "react";
import { useProteinStructureRenderer } from "@/components/structure/useProteinStructureRenderer";
import type { CandidateGene, StructureAdapterState } from "@/lib/domain";
import { getStructureMetadata, structurePoints } from "@/lib/structure-model";

type ProteinStructureViewerProps = {
  gene?: CandidateGene;
  selectedResidue: number | null;
  onSelectResidue: (residueNumber: number) => void;
  onOpenEvidence: (title: string, detail: string) => void;
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
  onOpenEvidence,
  onOpenMolstar,
}: ProteinStructureViewerProps) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [hoveredResidue, setHoveredResidue] = useState<number | null>(null);
  const [loadedPoints, setLoadedPoints] = useState(structurePoints);
  const [adapterState, setAdapterState] = useState<StructureAdapterState>({
    source: "demo-canvas",
    status: "loading",
    accession: "AF-Q01094-F1",
    message: "正在加载结构适配器…",
  });
  const structure = getStructureMetadata(gene?.symbol);
  useEffect(() => {
    let cancelled = false;
    setAdapterState({
      source: "pdb",
      status: "loading",
      accession: structure.accession,
      message: "正在加载 PDB 结构文件…",
    });
    fetch(`/api/structures/${structure.accession}?format=pdb`)
      .then(async (response) => {
        if (!response.ok) throw new Error("结构接口不可用");
        return (await response.json()) as {
          state: StructureAdapterState;
          points: typeof structurePoints;
        };
      })
      .then((result) => {
        if (cancelled) return;
        setLoadedPoints(result.points.length ? result.points : structurePoints);
        setAdapterState(result.state);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadedPoints(structurePoints);
        setAdapterState({
          source: "demo-canvas",
          status: "fallback",
          accession: structure.accession,
          message: "PDB 加载失败，已回退到轻量 Canvas 结构预览",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [structure.accession]);
  const selectedPoint = useMemo(
    () =>
      loadedPoints.find((point) => point.residueNumber === selectedResidue) ||
      loadedPoints.find((point) => point.residueNumber === hoveredResidue),
    [hoveredResidue, loadedPoints, selectedResidue],
  );
  const renderer = useProteinStructureRenderer({
    points: loadedPoints,
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
          <small>
            {adapterState.source.toUpperCase()} · {structure.accession} ·{" "}
            {adapterState.status === "ready" ? "文件已加载" : "轻量预览"}
          </small>
          <b>{gene?.symbol || "E2F1"} 三维结构</b>
        </div>
        <div>
          <button
            type="button"
            className="structure-rotate-toggle"
            onClick={() => setAutoRotate((current) => !current)}
          >
            {autoRotate ? "暂停旋转" : "自动旋转"}
          </button>
          <button type="button" onClick={renderer.resetView}>
            复位
          </button>
        </div>
      </div>

      <div className="protein-canvas-shell">
        <canvas
          ref={renderer.canvasRef}
          tabIndex={0}
          aria-label={`${structure.name} 三维结构，可拖拽旋转、按住 Control 或 Command 使用滚轮缩放并点击残基`}
          onPointerDown={renderer.handlePointerDown}
          onPointerMove={renderer.handlePointerMove}
          onPointerUp={renderer.handlePointerUp}
          onPointerLeave={renderer.handlePointerLeave}
          onWheel={renderer.handleWheel}
        />
        <span className="structure-interaction-hint">
          Canvas 轻量降级 · 拖拽旋转 · Ctrl/⌘ + 滚轮缩放 · 点击残基
        </span>
        <span className={`structure-load-state ${adapterState.status}`}>
          {adapterState.status === "loading"
            ? "加载中"
            : adapterState.status === "ready"
              ? "PDB 已加载"
              : "Fallback"}
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
            来自火山图候选基因 · FDR {gene.fdr} · log₂FC {gene.log2FoldChange > 0 ? "+" : ""}
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
        <small className="structure-adapter-message">{adapterState.message}</small>
      </section>

      <section className="structure-evidence-chain" aria-label="结构证据链">
        <small>结构证据链</small>
        <div className="structure-chain">
          <b>{gene?.symbol || "E2F1"}</b>
          <span>→</span>
          <b>{structure.accession}</b>
          <span>→</span>
          <b>
            {selectedPoint
              ? `${selectedPoint.aminoAcid} ${selectedPoint.residueNumber}`
              : "选择残基"}
          </b>
          <span>→</span>
          <b>{selectedPoint ? `pLDDT ${selectedPoint.confidence}` : "等待定位"}</b>
        </div>
        <p>
          {selectedPoint
            ? "该残基上下文可回溯到候选基因统计结果和当前结构证据。"
            : "点击结构点后，这里会显示残基置信度并建立结果关联。"}
        </p>
        <button
          className="structure-evidence-button"
          disabled={!selectedPoint}
          onClick={() => {
            if (!selectedPoint) return;
            const geneLabel = gene?.symbol || "E2F1";
            onOpenEvidence(
              `${geneLabel} · ${selectedPoint.aminoAcid} ${selectedPoint.residueNumber} 结构证据`,
              `${geneLabel} → ${structure.accession} → ${selectedPoint.aminoAcid} ${selectedPoint.residueNumber} · pLDDT ${selectedPoint.confidence}。` +
                (gene
                  ? `候选基因 FDR ${gene.fdr}，log₂FC ${gene.log2FoldChange > 0 ? "+" : ""}${gene.log2FoldChange}；可回到火山图和结果血缘继续审查。`
                  : "当前展示默认候选基因 E2F1；可先在结果面板选择其他候选基因。"),
            );
          }}
        >
          查看关联证据
        </button>
      </section>

      <button className="secondary full" onClick={onOpenMolstar}>
        在 Mol* 中打开完整结构
      </button>
    </div>
  );
}
