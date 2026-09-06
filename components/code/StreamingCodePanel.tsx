"use client";

import { useEffect, useRef } from "react";
import { PythonCodeBlock } from "@/components/code/PythonCodeBlock";
import type { ArtifactRecord } from "@/lib/domain";

type StreamingCodePanelProps = {
  codeText: string;
  running: boolean;
  streaming: boolean;
  artifacts: ArtifactRecord[];
  onRunDemo: () => void;
  onNotify: (message: string) => void;
  onOpenNode: (nodeId: string) => void;
  onOpenEvidence: (title: string, detail: string) => void;
};

/** AI 代码产物面板：呈现 SSE 增量、操作入口以及代码到方法和证据的血缘。 */
export function StreamingCodePanel({
  codeText,
  running,
  streaming,
  artifacts,
  onRunDemo,
  onNotify,
  onOpenNode,
  onOpenEvidence,
}: StreamingCodePanelProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const codeArtifact = artifacts.find((artifact) => artifact.kind === "code");
  const phase = streaming
    ? "正在流式生成"
    : codeArtifact
      ? "已验证并绑定结果"
      : codeText
        ? "草稿已生成"
        : "等待智能体生成";

  useEffect(() => {
    if (streaming && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [codeText, streaming]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      onNotify("分析代码已复制");
    } catch {
      onNotify("浏览器未授权剪贴板，请使用下载功能");
    }
  };

  const downloadCode = () => {
    const downloadUrl = URL.createObjectURL(
      new Blob([codeText], { type: "text/x-python;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = codeArtifact?.name || "analysis.py";
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
    onNotify("Python 分析代码已下载");
  };

  if (!codeText) {
    return (
      <div className="code-empty-state">
        <span aria-hidden="true">&lt;/&gt;</span>
        <small>可复现代码产物</small>
        <h3>运行后实时生成分析代码</h3>
        <p>代码将通过 SSE 逐字符写入，并与统计方法、参数快照和结果版本绑定。</p>
        <button className="primary" onClick={onRunDemo} disabled={running}>
          {running ? "工作流运行中…" : "运行并生成代码"}
        </button>
      </div>
    );
  }

  return (
    <div className="streaming-code-panel">
      <header className="streaming-code-head">
        <div>
          <small>AI 生成 · Python</small>
          <b>{codeArtifact?.name || "analysis.py"}</b>
        </div>
        <span className={streaming ? "streaming" : "ready"}>
          <i /> {phase}
        </span>
      </header>

      <div className="code-generation-progress">
        <i style={{ width: streaming ? "68%" : "100%" }} />
      </div>

      <div className="code-scroll-viewport" ref={viewportRef}>
        <PythonCodeBlock code={codeText} streaming={streaming} />
      </div>

      <div className="code-actions">
        <button onClick={copyCode}>复制代码</button>
        <button onClick={downloadCode}>下载 .py</button>
        <button onClick={onRunDemo} disabled={running || streaming}>重新生成</button>
      </div>

      <section className="code-lineage-card">
        <div>
          <small>代码血缘</small>
          <b>{codeArtifact?.version || "草稿"} · DESeq2</b>
        </div>
        <dl>
          <div><dt>设计公式</dt><dd>~ condition + batch</dd></div>
          <div><dt>统计方法</dt><dd>negative binomial</dd></div>
          <div><dt>结果绑定</dt><dd>volcano_plot.svg</dd></div>
        </dl>
        <div className="code-lineage-actions">
          <button onClick={() => onOpenNode("de")}>定位生成节点</button>
          <button
            onClick={() =>
              onOpenEvidence(
                "DESeq2 技能包 · v2.1",
                "代码由已审批计划、设计矩阵和 DESeq2 技能包共同生成。",
              )
            }
          >
            查看方法证据
          </button>
        </div>
      </section>
    </div>
  );
}
