"use client";

import type { PointerEvent, WheelEvent } from "react";
import type { WorkflowPosition } from "@/lib/domain";

export type WorkflowNode = {
  id: string;
  label: string;
  kind: string;
  status: string;
  x: number;
  y: number;
  detail: string;
};

export type LayoutSaveState = "loading" | "idle" | "saving" | "saved" | "error";

type WorkflowCanvasProps = {
  open: boolean;
  nodes: WorkflowNode[];
  edges: string[][];
  extraEdges: string[][];
  selected: string;
  impactNodeIds?: string[];
  connectingFrom: string | null;
  canvasZoom: number;
  canvasPan: WorkflowPosition;
  nodePositions: Record<string, WorkflowPosition>;
  layoutRevision: number;
  layoutVersionCount: number;
  layoutSaveState: LayoutSaveState;
  creatingVersion: boolean;
  onZoomChange: (next: (value: number) => number) => void;
  onReset: () => void;
  onCreateVersion: () => void;
  onCanvasPanStart: (event: PointerEvent<HTMLDivElement>) => void;
  onCanvasWheel: (event: WheelEvent<HTMLDivElement>) => void;
  onNodePointerDown: (node: WorkflowNode, event: PointerEvent<HTMLButtonElement>) => void;
};

/**
 * 可编辑分析工作流画布：布局自动保存到服务端，运行状态仍由任务快照独立驱动。
 */
export function WorkflowCanvas({
  open,
  nodes,
  edges,
  extraEdges,
  selected,
  impactNodeIds = [],
  connectingFrom,
  canvasZoom,
  canvasPan,
  nodePositions,
  layoutRevision,
  layoutVersionCount,
  layoutSaveState,
  creatingVersion,
  onZoomChange,
  onReset,
  onCreateVersion,
  onCanvasPanStart,
  onCanvasWheel,
  onNodePointerDown,
}: WorkflowCanvasProps) {
  const updateZoom = (delta: number) => {
    onZoomChange((value) => Math.min(1.6, Math.max(0.55, value + delta)));
  };

  return (
    <div className={`canvas-wrap ${open ? "" : "plan-collapsed"}`} data-guide="workflow">
      <div className="canvas-toolbar">
        <span>
          分析工作流 / v1.{layoutVersionCount}
          <em>
            {connectingFrom
              ? `正在连线：${connectingFrom} → Shift 点击目标节点`
              : "拖拽节点 · 拖动画布 · 滚轮缩放 · Shift+点击连线"}
          </em>
          <small className={`layout-save-state ${layoutSaveState}`}>
            {layoutSaveState === "loading"
              ? "正在恢复布局"
              : layoutSaveState === "saving"
                ? "正在自动保存"
                : layoutSaveState === "saved"
                  ? `已自动保存 · r${layoutRevision}`
                  : layoutSaveState === "error"
                    ? "自动保存失败"
                    : "布局已就绪"}
          </small>
        </span>
        <div>
          <button onClick={() => updateZoom(-0.1)} aria-label="缩小">
            −
          </button>
          <span>{Math.round(canvasZoom * 100)}%</span>
          <button onClick={() => updateZoom(0.1)} aria-label="放大">
            ＋
          </button>
          <button onClick={onReset} aria-label="居中并重置">
            ⊙
          </button>
          <button
            className="layout-version-button"
            onClick={onCreateVersion}
            disabled={creatingVersion || layoutSaveState === "loading"}
          >
            {creatingVersion ? "保存中…" : "保存版本"}
          </button>
        </div>
      </div>
      <div
        className="canvas canvas-viewport"
        onPointerDown={onCanvasPanStart}
        onWheel={onCanvasWheel}
      >
        <div
          className="canvas-stage"
          style={{
            transform: `translate(${canvasPan.x}px,${canvasPan.y}px) scale(${canvasZoom})`,
          }}
        >
          <svg className="edges" viewBox="0 0 1000 500" preserveAspectRatio="none">
            {[...edges, ...extraEdges].map(([from, to]) => {
              const source = nodes.find((node) => node.id === from);
              const target = nodes.find((node) => node.id === to);
              if (!source || !target) return null;
              const sourcePosition = nodePositions[from] || source;
              const targetPosition = nodePositions[to] || target;
              return (
                <line
                  key={`${from}-${to}`}
                  x1={sourcePosition.x + 170}
                  y1={sourcePosition.y + 55}
                  x2={targetPosition.x}
                  y2={targetPosition.y + 55}
                  className={`${
                    source.status === "succeeded" && target.status !== "blocked"
                      ? "edge-done"
                      : "edge"
                  } ${impactNodeIds.includes(source.id) || impactNodeIds.includes(target.id) ? "edge-impact" : ""}`}
                />
              );
            })}
          </svg>
          {nodes.map((node) => {
            const position = nodePositions[node.id] || node;
            return (
              <button
                key={node.id}
                className={`node ${node.status} ${
                  selected === node.id ? "selected" : ""
                } ${connectingFrom === node.id ? "connecting" : ""} ${impactNodeIds.includes(node.id) ? "impact" : ""}`}
                style={{ left: position.x, top: position.y }}
                onPointerDown={(event) => onNodePointerDown(node, event)}
              >
                <div className="node-head">
                  <span className={`node-icon ${node.kind}`}>
                    {node.kind === "artifact"
                      ? "▧"
                      : node.kind === "gate"
                        ? "◇"
                        : node.kind === "input"
                          ? "⇩"
                          : "◉"}
                  </span>
                  <span className="node-status">
                    {node.status === "succeeded"
                      ? "✓"
                      : node.status === "failed"
                        ? "!"
                        : node.status === "running"
                          ? "◌"
                          : "·"}
                  </span>
                </div>
                <b>{node.label}</b>
                <small>{node.detail}</small>
                {node.status === "running" && (
                  <div className="progress">
                    <i />
                  </div>
                )}
                {node.status === "failed" && <span className="fix-hint">需要处理</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="minimap">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
