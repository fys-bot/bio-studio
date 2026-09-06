"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  clarificationQuestions,
  type ClarificationAnswers,
} from "@/components/ClarificationCard";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { ResultsPanel } from "@/components/results/ResultsPanel";
import { ProteinStructureViewer } from "@/components/structure/ProteinStructureViewer";
import type { ArtifactRecord } from "@/lib/domain";

export type InspectorTab =
  | "todo"
  | "results"
  | "compute"
  | "notes"
  | "evidence"
  | "logs"
  | "code"
  | "structure";

type InspectorNode = {
  label: string;
  status: string;
  error?: string;
};

type InspectorDrawerProps = {
  isOpen: boolean;
  activeTab: InspectorTab;
  selectedNode?: InspectorNode;
  statusLabels: Record<string, string>;
  answers: ClarificationAnswers;
  liveLogs: string[];
  running: boolean;
  retrying: boolean;
  codeText: string;
  selectedResidue: number | null;
  artifacts: ArtifactRecord[];
  onTabChange: (tab: InspectorTab) => void;
  onClose: () => void;
  onSelectQuestion: (questionIndex: number) => void;
  onOpenSource: (title: string, detail: string) => void;
  onRetry: () => void;
  onRunDemo: () => void;
  onDownloadVolcano: () => void;
  onSelectResultSource: (nodeId: string) => void;
  onResidueSelect: (residueNumber: number) => void;
  onOpenMolstar: () => void;
  onDownloadReport: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

/**
 * 研究工具检查器：集中呈现证据、日志、代码、结果、3D 和待办视图。
 * 所有任务状态与副作用通过 Props 注入，便于后续替换为可配置的插件面板。
 */
export function InspectorDrawer({
  isOpen,
  activeTab,
  selectedNode,
  statusLabels,
  answers,
  liveLogs,
  running,
  retrying,
  codeText,
  selectedResidue,
  artifacts,
  onTabChange,
  onClose,
  onSelectQuestion,
  onOpenSource,
  onRetry,
  onRunDemo,
  onDownloadVolcano,
  onSelectResultSource,
  onResidueSelect,
  onOpenMolstar,
  onDownloadReport,
  onResizeStart,
}: InspectorDrawerProps) {
  const completedQuestionCount = Object.values(answers).filter(Boolean).length;
  const [selectedGeneSymbol, setSelectedGeneSymbol] = useState<string | null>(null);
  const selectedGene = artifacts
    .find((artifact) => artifact.kind === "chart")
    ?.candidateGenes?.find((gene) => gene.symbol === selectedGeneSymbol);
  const sourceNames = [
    "项目元数据规范",
    "DESeq2 技能包 · v2.1",
    "Bioconductor 设计指南",
    "质控策略 · 2026-08",
  ];

  return (
    <aside className={`inspector ${isOpen ? "mobile-open" : ""}`}>
      <div className="drawer-heading">
        <div>
          <small>研究工具</small>
          <b>
            {{
              todo: "任务待办",
              results: "结果产物",
              compute: "计算资源",
              notes: "研究笔记",
              evidence: "证据依据",
              logs: "运行日志",
              code: "分析代码",
              structure: "3D 结构",
            }[activeTab]}
          </b>
        </div>
        <button className="close-inspector" onClick={onClose} aria-label="关闭工具抽屉">
          ×
        </button>
      </div>
      <div className="inspector-tabs">
        {[
          ["evidence", "证据"],
          ["logs", "日志"],
          ["code", "代码"],
          ["results", "结果"],
          ["structure", "3D"],
        ].map(([tabKey, label]) => (
          <button
            key={tabKey}
            className={activeTab === tabKey ? "active" : ""}
            onClick={() => onTabChange(tabKey as InspectorTab)}
          >
            {label}
          </button>
        ))}
      </div>
      {activeTab === "todo" && (
        <div className="tool-view todo-view">
          <div className="tool-summary">
            <b>分析准备</b>
            <span>{completedQuestionCount} / 4 已完成</span>
          </div>
          {clarificationQuestions.map((question, questionIndex) => (
            <button
              key={question.key}
              onClick={() => onSelectQuestion(questionIndex)}
            >
              <i>{answers[question.key] ? "✓" : "○"}</i>
              <span>
                <b>{question.label}</b>
                <small>{answers[question.key] || "等待你的选择"}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      {activeTab === "compute" && (
        <div className="tool-view compute-view">
          <div className="compute-status">
            <i />计算环境待命
          </div>
          <h3>标准分析环境</h3>
          <p>4 vCPU · 16 GB 内存 · Python / R</p>
          <dl>
            <div>
              <dt>运行时</dt>
              <dd>BioFlow RNA-seq 1.4</dd>
            </div>
            <div>
              <dt>数据区域</dt>
              <dd>本地项目空间</dd>
            </div>
            <div>
              <dt>外发数据</dt>
              <dd>无</dd>
            </div>
          </dl>
        </div>
      )}
      {activeTab === "notes" && (
        <div className="tool-view notes-view">
          <textarea defaultValue={`研究备注

• 比较处理组与对照组
• 优先关注 FDR < 0.05 的基因
• 输出可发表火山图与方法说明`} />
          <small>笔记保存在当前任务上下文中</small>
        </div>
      )}
      {activeTab === "evidence" && (
        <>
          <div className="inspector-title">
            <small>当前选中节点</small>
            <h2>{selectedNode?.label}</h2>
            <span className={`status-pill ${selectedNode?.status}`}>
              {statusLabels[selectedNode?.status || ""] || selectedNode?.status}
            </span>
          </div>
          <div className="explain-card">
            <span>✦ 为什么需要这一步？</span>
            <p>
              这一步会在统计分析前校验样本结构，避免分组误配，并保证最终报告可复现。
            </p>
          </div>
          <div className="source-list">
            <h3>
              依据来源 <span>4</span>
            </h3>
            {sourceNames.map((sourceName, sourceIndex) => (
              <button
                className="source"
                key={sourceName}
                onClick={() =>
                  onOpenSource(
                    sourceName,
                    `${sourceIndex === 0 ? "直接匹配" : "语义匹配"} · 0.${
                      91 - sourceIndex
                    } 相关度 · 已绑定到 ${selectedNode?.label || "当前节点"}`,
                  )
                }
              >
                <i>{sourceIndex + 1}</i>
                <span>
                  <b>{sourceName}</b>
                  <small>
                    {sourceIndex === 0 ? "直接匹配" : "语义匹配"} · 0.{91 - sourceIndex} 相关度
                  </small>
                </span>
                <em>↗</em>
              </button>
            ))}
          </div>
          <KnowledgeGraph nodeLabel={selectedNode?.label || "当前节点"} />
          {selectedNode?.status === "failed" && (
            <div className="error-card">
              <b>⚠ 校验未通过</b>
              <p>{selectedNode.error}</p>
              <button className="primary full" onClick={onRetry} disabled={retrying}>
                {retrying ? "重试中…" : "映射 condition 并重试"}
              </button>
            </div>
          )}
        </>
      )}
      {activeTab === "logs" && (
        <div className="log-view">
          <div className="log-live">
            <i /> 实时事件流
          </div>
          {(liveLogs.length ? liveLogs : ["等待运行事件…"]).map(
            (logLine, logIndex) => (
              <p
                key={`${logLine}${logIndex}`}
                className={logLine.includes("failed") ? "log-error" : ""}
              >
                {logLine}
              </p>
            ),
          )}
        </div>
      )}
      {activeTab === "code" && (
        <div className="code-view">
          <div className="code-head">
            <span>analysis.py</span>
            <span className="code-state">● {running ? "生成中" : "就绪"}</span>
          </div>
          <pre>
            <code>
              {codeText || `import pandas as pd
from deseq2 import DESeqDataSet

counts = pd.read_csv("counts.csv")
metadata = pd.read_csv("sample_metadata.tsv")

# Validate before execution
assert "condition" in metadata.columns
`}
            </code>
          </pre>
          <button className="primary full" onClick={onRunDemo} disabled={running}>
            {running ? "代码生成中…" : "运行代码"}
          </button>
        </div>
      )}
      {activeTab === "results" && (
        <ResultsPanel
          artifacts={artifacts}
          running={running}
          selectedGeneSymbol={selectedGeneSymbol}
          onSelectGene={setSelectedGeneSymbol}
          onRunDemo={onRunDemo}
          onDownloadVolcano={onDownloadVolcano}
          onDownloadReport={onDownloadReport}
          onOpenNode={onSelectResultSource}
          onOpenEvidence={onOpenSource}
        />
      )}
      {activeTab === "structure" && (
        <ProteinStructureViewer
          gene={selectedGene}
          selectedResidue={selectedResidue}
          onSelectResidue={onResidueSelect}
          onOpenMolstar={onOpenMolstar}
        />
      )}
      <div
        className="vertical-splitter right"
        onPointerDown={onResizeStart}
        title="拖拽调整检查器宽度"
      />
    </aside>
  );
}
