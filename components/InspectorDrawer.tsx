"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { clarificationQuestions, type ClarificationAnswers } from "@/components/ClarificationCard";
import { ResultsPanel } from "@/components/results/ResultsPanel";
import { ProteinStructureViewer } from "@/components/structure/ProteinStructureViewer";
import { StreamingCodePanel } from "@/components/code/StreamingCodePanel";
import type { ArtifactRecord } from "@/lib/domain";
import type { RagTrace } from "@/lib/domain";
import { RagTracePanel } from "@/components/RagTracePanel";

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
  id: string;
  kind: string;
  label: string;
  status: string;
  detail: string;
  error?: string;
};

type InspectorDrawerProps = {
  isOpen: boolean;
  activeTab: InspectorTab;
  selectedNode?: InspectorNode;
  workflowNodes: InspectorNode[];
  workflowEdges: string[][];
  statusLabels: Record<string, string>;
  answers: ClarificationAnswers;
  liveLogs: string[];
  streamStatus: "connected" | "reconnecting" | "disconnected";
  sampleCount: number;
  running: boolean;
  codeStreaming: boolean;
  retrying: boolean;
  codeText: string;
  notes: string;
  selectedResidue: number | null;
  artifacts: ArtifactRecord[];
  ragTrace: RagTrace | null;
  selectedChunkId?: string | null;
  onTabChange: (tab: InspectorTab) => void;
  onNotesChange: (notes: string) => void;
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
  onNotify: (message: string) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCopy?: (value: string) => void;
};

/**
 * 研究工具检查器：集中呈现证据、日志、代码、结果、3D 和待办视图。
 * 所有任务状态与副作用通过 Props 注入，便于后续替换为可配置的插件面板。
 */
export function InspectorDrawer({
  isOpen,
  activeTab,
  selectedNode,
  workflowNodes,
  workflowEdges,
  statusLabels,
  answers,
  liveLogs,
  streamStatus,
  sampleCount,
  running,
  codeStreaming,
  retrying,
  codeText,
  notes,
  selectedResidue,
  artifacts,
  ragTrace,
  selectedChunkId,
  onTabChange,
  onNotesChange,
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
  onNotify,
  onResizeStart,
  onCopy,
}: InspectorDrawerProps) {
  const completedQuestionCount = Object.values(answers).filter(Boolean).length;
  const [selectedGeneSymbol, setSelectedGeneSymbol] = useState<string | null>(null);
  const selectedGene = artifacts
    .find((artifact) => artifact.kind === "chart")
    ?.candidateGenes?.find((gene) => gene.symbol === selectedGeneSymbol);
  const traceEvidence = (ragTrace?.rerankedResults ?? [])
    .filter((result) => result.kept)
    .map((result) => {
      const document = ragTrace?.parsedDocuments.find((item) => item.id === result.documentId);
      const chunk = ragTrace?.chunks.find((item) => item.id === result.chunkId);
      return { result, document, chunk };
    });
  const downstreamNodes = selectedNode
    ? workflowEdges
        .filter(([from]) => from === selectedNode.id)
        .map(([, to]) => workflowNodes.find((node) => node.id === to))
        .filter(Boolean)
    : [];
  const upstreamNodes = selectedNode
    ? workflowEdges
        .filter(([, to]) => to === selectedNode.id)
        .map(([from]) => workflowNodes.find((node) => node.id === from))
        .filter(Boolean)
    : [];

  return (
    <aside className={`inspector ${isOpen ? "mobile-open" : ""}`}>
      <div className="drawer-heading">
        <div>
          <small>研究工具</small>
          <b>
            {
              {
                todo: "任务待办",
                results: "结果产物",
                compute: "计算资源",
                notes: "研究笔记",
                evidence: "证据依据",
                logs: "运行日志",
                code: "分析代码",
                structure: "3D 结构",
              }[activeTab]
            }
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
            <button key={question.key} onClick={() => onSelectQuestion(questionIndex)}>
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
            <i />
            计算环境待命
          </div>
          <h3>标准分析环境</h3>
          <p>4 vCPU · 16 GB 内存 · Python / R</p>
          <p className="compute-sample-count">当前任务 · {sampleCount} 个样本</p>
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
          <textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder={`研究备注

• 比较处理组与对照组
• 优先关注 FDR < 0.05 的基因
• 输出可发表火山图与方法说明`}
          />
          <small>笔记自动保存到当前任务上下文</small>
        </div>
      )}
      {activeTab === "evidence" && (
        <>
          <RagTracePanel
            trace={ragTrace}
            selectedChunkId={selectedChunkId}
            onCopy={onCopy}
            onChunkSelect={(chunkId) => onOpenSource("RAG 证据片段", chunkId)}
          />
          <div className="inspector-title">
            <small>当前选中节点</small>
            <h2>{selectedNode?.label}</h2>
            <span className={`status-pill ${selectedNode?.status}`}>
              {statusLabels[selectedNode?.status || ""] || selectedNode?.status}
            </span>
          </div>
          <div className="explain-card">
            <span>✦ 为什么需要这一步？</span>
            <p>{selectedNode?.detail || "选择一个工作流节点查看它的输入、输出和影响范围。"}</p>
            <div className="node-impact-grid">
              <div>
                <small>上游输入</small>
                <b>
                  {upstreamNodes.length
                    ? upstreamNodes.map((node) => node?.label).join("、")
                    : "项目文件"}
                </b>
              </div>
              <div>
                <small>下游影响</small>
                <b>
                  {downstreamNodes.length ? `${downstreamNodes.length} 个节点` : "当前节点为入口"}
                </b>
              </div>
            </div>
          </div>
          {traceEvidence.length > 0 && (
            <div className="source-list trace-source-list">
              <h3>
                本次检索保留证据 <span>{traceEvidence.length}</span>
              </h3>
              {traceEvidence.map(({ result, document, chunk }, sourceIndex) => (
                <button
                  className="source"
                  key={result.chunkId}
                  onClick={() =>
                    onOpenSource(
                      document?.name || result.documentId,
                      `${chunk?.text || "未返回片段正文"}\n\n精排分数 ${result.rerankScore.toFixed(3)} · ${result.rationale}`,
                    )
                  }
                >
                  <i>{sourceIndex + 1}</i>
                  <span>
                    <b>{document?.name || result.documentId}</b>
                    <small>
                      {result.retrievalMethod} · 精排 {result.rerankScore.toFixed(3)}
                    </small>
                  </span>
                  <em>↗</em>
                </button>
              ))}
            </div>
          )}
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
            <span className={`stream-status ${streamStatus}`}>
              {streamStatus === "connected"
                ? "已连接"
                : streamStatus === "reconnecting"
                  ? "重连中"
                  : "已断开"}
            </span>
          </div>
          {(liveLogs.length ? liveLogs : ["等待运行事件…"]).map((logLine, logIndex) => (
            <p
              key={`${logLine}${logIndex}`}
              className={logLine.includes("failed") ? "log-error" : ""}
            >
              {logLine}
            </p>
          ))}
        </div>
      )}
      {activeTab === "code" && (
        <StreamingCodePanel
          codeText={codeText}
          running={running}
          streaming={codeStreaming}
          artifacts={artifacts}
          onRunDemo={onRunDemo}
          onNotify={onNotify}
          onOpenNode={onSelectResultSource}
          onOpenEvidence={onOpenSource}
        />
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
          onOpenEvidence={onOpenSource}
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
