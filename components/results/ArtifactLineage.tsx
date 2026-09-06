"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { ArtifactRecord } from "@/lib/domain";

type ArtifactLineageProps = {
  artifact: ArtifactRecord;
  onOpenNode: (nodeId: string) => void;
  onOpenEvidence: (title: string, detail: string) => void;
};

/** 展示 Artifact 的输入、参数、方法、证据和输出，承担结果可解释性入口。 */
export function ArtifactLineage({ artifact, onOpenNode, onOpenEvidence }: ArtifactLineageProps) {
  const [expanded, setExpanded] = useState(false);
  const [parameterSnapshotOpen, setParameterSnapshotOpen] = useState(false);
  const parameters = Object.entries(artifact.parameters || {});

  return (
    <section className="lineage-card" aria-label="结果血缘">
      <div className="lineage-heading">
        <div>
          <small>可复现性</small>
          <b>⌁ 结果血缘</b>
        </div>
        <button onClick={() => setExpanded((current) => !current)}>
          {expanded ? "收起链路" : "展开链路"}
        </button>
      </div>

      <p>{(artifact.lineage || []).map((step) => step.label).join(" → ")}</p>
      <button className="parameter-snapshot-trigger" onClick={() => setParameterSnapshotOpen(true)}>
        查看运行参数快照
      </button>

      {expanded && (
        <ol className="lineage-steps">
          {(artifact.lineage || []).map((step, stepIndex) => (
            <li key={step.id}>
              <span className={`lineage-kind ${step.kind}`}>{stepIndex + 1}</span>
              <div>
                <b>{step.label}</b>
                <small>{step.detail}</small>
              </div>
              {step.nodeId && <button onClick={() => onOpenNode(step.nodeId!)}>定位节点</button>}
              {step.evidenceTitle && (
                <button onClick={() => onOpenEvidence(step.evidenceTitle!, step.detail)}>
                  查看证据
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {parameterSnapshotOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="parameter-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setParameterSnapshotOpen(false);
              }
            }}
          >
            <section
              className="parameter-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="parameter-dialog-title"
            >
              <div className="parameter-dialog-head">
                <div>
                  <small>只读快照 · {artifact.version}</small>
                  <h3 id="parameter-dialog-title">运行参数</h3>
                </div>
                <button aria-label="关闭参数快照" onClick={() => setParameterSnapshotOpen(false)}>
                  ×
                </button>
              </div>
              <dl>
                {parameters.map(([parameterName, parameterValue]) => (
                  <div key={parameterName}>
                    <dt>{parameterName}</dt>
                    <dd>{parameterValue}</dd>
                  </div>
                ))}
                <div>
                  <dt>来源节点</dt>
                  <dd>{artifact.sourceNode}</dd>
                </div>
                <div>
                  <dt>生成时间</dt>
                  <dd>
                    {artifact.createdAt
                      ? new Date(artifact.createdAt).toLocaleString("zh-CN")
                      : "—"}
                  </dd>
                </div>
              </dl>
              <p>参数随 Artifact 版本固化，可用于复现实验和审计结果差异。</p>
            </section>
          </div>,
          document.body,
        )}
    </section>
  );
}
