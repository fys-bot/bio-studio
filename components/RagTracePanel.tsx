"use client";

import { useState } from "react";
import type { RagTrace } from "@/lib/domain";

type RagTracePanelProps = {
  trace: RagTrace | null;
  selectedChunkId?: string | null;
  onCopy?: (value: string) => void;
  onChunkSelect?: (chunkId: string) => void;
};

const stages: Array<{ key: keyof RagTrace; label: string; description: string }> = [
  { key: "parsedDocuments", label: "文档解析", description: "识别文件来源、解析器和结构状态" },
  { key: "chunks", label: "文档切分", description: "把文档切成可检索的上下文片段" },
  {
    key: "retrievalTop20",
    label: "混合召回 Top 20",
    description: "关键词、向量和项目过滤共同召回",
  },
  { key: "rerankedResults", label: "精排", description: "按实体、实验设计和参数相关性重排" },
  { key: "graphRelations", label: "知识图谱扩展", description: "补齐基因、通路、文献和参数关系" },
  { key: "groundingBindings", label: "参数 grounding", description: "将可执行参数绑定到证据片段" },
  { key: "toolCalls", label: "工具调用", description: "选择并运行可审计的科研工具" },
];

export function RagTracePanel({
  trace,
  selectedChunkId,
  onCopy,
  onChunkSelect,
}: RagTracePanelProps) {
  const [expanded, setExpanded] = useState<string | null>("retrievalTop20");
  const [fallbackStrategy, setFallbackStrategy] = useState("");
  if (!trace)
    return (
      <section className="rag-trace-empty">
        <div className="rag-demo-banner">
          演示模式 · 当前 RAG 使用可替换的确定性 Adapter，接口契约与生产实现一致。
        </div>
        <span>✦</span>
        <div>
          <b>等待下一次问题的 RAG Trace</b>
          <p>在下方输入研究问题后，这里会展示文档解析、召回 Top 20、精排、知识图谱和工具调用。</p>
        </div>
      </section>
    );
  return (
    <section className="rag-trace-panel" aria-label="RAG 全链路 Trace">
      <div className="rag-demo-banner">
        {trace.indexSummary?.provider === "qdrant"
          ? "真实文档检索 · Qdrant + multilingual MiniLM + BM25 / RRF"
          : "演示 Trace · 非真实检索结论"}
      </div>
      <div className="rag-ingestion-summary" aria-label="文档摄取与索引状态">
        <div className="rag-ingestion-head">
          <b>文档摄取链路</b>
          <small>
            {trace.indexSummary?.provider || "legacy-demo"} · {trace.indexSummary?.dimensions || 0}d
            · {trace.indexSummary?.collection}
          </small>
        </div>
        <div className="rag-ingestion-stages">
          {(trace.ingestionStages ?? []).map((stage) => (
            <span className={stage.status} key={stage.key} title={stage.detail}>
              <i /> {stage.label}
            </span>
          ))}
        </div>
      </div>
      <header>
        <div>
          <small>RAG TRACE · {trace.id.slice(0, 18)}</small>
          <h3>智能体如何从问题走到工具</h3>
        </div>
        <button className="text-button" onClick={() => onCopy?.(JSON.stringify(trace, null, 2))}>
          复制审计 JSON
        </button>
      </header>
      <div className="rag-query">
        <span>用户问题</span>
        <b>{trace.query}</b>
        <small>
          {trace.durationMs} ms · {trace.parsedDocuments.length} 类来源 ·{" "}
          {trace.retrievalTop20.length} 条召回
        </small>
      </div>
      <div className="rag-stage-list">
        {stages.map((stage, index) => {
          const value = trace[stage.key];
          const isOpen = expanded === stage.key;
          const count = Array.isArray(value) ? value.length : 0;
          return (
            <div className={`rag-stage ${isOpen ? "open" : ""}`} key={stage.key}>
              <button onClick={() => setExpanded(isOpen ? null : String(stage.key))}>
                <span className="rag-stage-index">{String(index + 1).padStart(2, "0")}</span>
                <span>
                  <b>{stage.label}</b>
                  <small>{stage.description}</small>
                </span>
                <em>
                  {count} 条 {isOpen ? "⌃" : "⌄"}
                </em>
              </button>
              {isOpen && (
                <div className="rag-stage-content">
                  {stage.key === "retrievalTop20" && (
                    <div className="retrieval-table">
                      <div className="retrieval-head">
                        <span>排名</span>
                        <span>来源片段</span>
                        <span>分数</span>
                        <span>方式</span>
                      </div>
                      {trace.retrievalTop20.map((item) => (
                        <button
                          className={`retrieval-row ${selectedChunkId === item.chunkId ? "selected" : ""}`}
                          key={item.chunkId}
                          type="button"
                          onClick={() => onChunkSelect?.(item.chunkId)}
                        >
                          <span>#{item.rank}</span>
                          <span>
                            {trace.chunks.find((chunk) => chunk.id === item.chunkId)?.text ||
                              item.chunkId}
                          </span>
                          <span>{item.score.toFixed(3)}</span>
                          <span>{item.retrievalMethod}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {stage.key !== "retrievalTop20" && <pre>{JSON.stringify(value, null, 2)}</pre>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <footer>
        <span className="trace-success">✓ {trace.finalDecision.summary}</span>
        <small>下一步：{trace.finalDecision.nextAction}</small>
      </footer>
      {trace.status === "failed" && (
        <div className="rag-fallback-actions">
          <span>检索失败后的处理策略</span>
          {["仅使用项目文件", "重新检索", "继续演示模式"].map((strategy) => (
            <button
              key={strategy}
              className={fallbackStrategy === strategy ? "selected" : ""}
              onClick={() => setFallbackStrategy(strategy)}
            >
              {strategy}
            </button>
          ))}
          {fallbackStrategy && <small>已选择：{fallbackStrategy}</small>}
        </div>
      )}
    </section>
  );
}
