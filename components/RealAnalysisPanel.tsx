"use client";
import StorageOutlined from "@mui/icons-material/StorageOutlined";
import { useEffect, useState } from "react";
import type { ProjectFileRecord, ResearchTask } from "@/lib/domain";
import type { AnalysisJob } from "@/lib/research-service";
import { authorizedFetch, bioflowApi, downloadAuthorizedFile } from "@/lib/api-client";
import { FilePreview } from "./FilePreview";
import { SelectControl } from "./ui/SelectControl";

export function RealAnalysisPanel({
  task,
  onTaskChange,
}: {
  task: ResearchTask;
  onTaskChange: (task: ResearchTask) => void;
}) {
  const [files, setFiles] = useState<ProjectFileRecord[]>([]);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const [volcanoUrl, setVolcanoUrl] = useState("");
  const [config, setConfig] = useState({
    countsId: "",
    metadataId: "",
    condition: "condition",
    control: "control",
    treated: "treated",
    batch: "",
    alpha: 0.05,
  });
  const ids = JSON.stringify(task.fileIds ?? []);
  useEffect(() => {
    let alive = true;
    void bioflowApi
      .listProjectFiles()
      .then((res) => {
        if (alive) {
          const bound = res.items.filter((file) => task.fileIds?.includes(file.id));
          setFiles(bound);
          setConfig((current) => ({
            ...current,
            countsId:
              current.countsId ||
              bound.find((file) => file.name === "practice_counts.csv")?.id ||
              "",
            metadataId:
              current.metadataId ||
              bound.find((file) => file.name === "practice_metadata.tsv")?.id ||
              "",
          }));
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [ids, task.id]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await authorizedFetch(`/api/tasks/${task.id}/analysis`);
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        if (stopped) return;
        setJob(result.job);
        if (result.task.status !== task.status) onTaskChange(result.task);
        if (result.job && ["running", "queued"].includes(result.job.status))
          timer = setTimeout(poll, 1000);
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : "状态读取失败");
      }
    };
    if (task.analysisJobId) void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [task.id, task.analysisJobId, task.status, onTaskChange]);
  const post = async (action: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await authorizedFetch(`/api/tasks/${task.id}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...config }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      if (result.job) setJob(result.job);
      onTaskChange(result.task);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!job?.result) {
      setVolcanoUrl("");
      return;
    }
    let stopped = false;
    let objectUrl = "";
    void authorizedFetch(`/api/tasks/${task.id}/analysis/volcano.png`)
      .then((response) => {
        if (!response.ok) throw new Error("火山图加载失败");
        return response.blob();
      })
      .then((blob) => {
        if (stopped) return;
        objectUrl = URL.createObjectURL(blob);
        setVolcanoUrl(objectUrl);
      })
      .catch((loadError) => {
        if (!stopped) setError(loadError instanceof Error ? loadError.message : "火山图加载失败");
      });
    return () => {
      stopped = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [job?.result, task.id]);
  const active = job && ["queued", "running"].includes(job.status);
  const computeSupported = !task.skill || task.skill.id === "rnaseq-deseq2";
  const selectedCountsFile = files.find((file) => file.id === config.countsId);
  const selectedMetadataFile = files.find((file) => file.id === config.metadataId);
  const inputsReady = Boolean(selectedCountsFile && selectedMetadataFile);
  const designReady = Boolean(config.condition && config.control && config.treated);
  const blockedByTask = ["draft", "clarifying", "awaiting_approval"].includes(task.status);
  const readyToRun = inputsReady && designReady && !blockedByTask && !active;
  const statusLabel = active
    ? "计算进行中"
    : job?.status === "succeeded"
      ? "结果已生成"
      : job?.status === "failed"
        ? "计算失败"
        : blockedByTask
          ? "等待计划确认"
          : readyToRun
            ? "可以运行"
            : "等待配置";
  return (
    <section className="real-analysis" id="real-analysis">
      <header className="real-analysis-head">
        <div>
          <small className="analysis-eyebrow">
            {task.skill ? `技能 / ${task.skill.name} / v${task.skill.version}` : "真实数据分析"}
          </small>
          <h2>{computeSupported ? "准备分析输入" : "配置任务文件"}</h2>
          <p>
            {computeSupported
              ? "按输入、实验设计和运行三个步骤完成真实 PyDESeq2 分析。"
              : "先检查技能契约与绑定文件，再继续配置该技能的执行适配器。"}
          </p>
        </div>
        <div className="real-analysis-actions">
          <span className={`analysis-status ${readyToRun ? "ready" : ""}`}>{statusLabel}</span>
          {computeSupported && (
            <button disabled={busy} onClick={() => void post("samples")}>
              <StorageOutlined sx={{ fontSize: 15 }} />
              载入示例输入
            </button>
          )}
        </div>
      </header>
      {task.skill && (
        <p className="bound-skill analysis-contract">
          输入：{task.skill.inputs.join("、")} · 输出：{task.skill.outputs.join("、")}
        </p>
      )}
      <section className="analysis-section analysis-inputs">
        <div className="analysis-section-head">
          <div className="analysis-step">
            <span>01</span>
            <div>
              <h3>绑定输入文件</h3>
              <p>文件只在当前项目内使用，点击文件卡片可查看解析正文和索引状态。</p>
            </div>
          </div>
          <span className={`analysis-section-state ${inputsReady ? "ready" : ""}`}>
            {files.length ? `${files.length} 份已绑定` : "尚未绑定"}
          </span>
        </div>
        <div className="bound-files">
          {files.map((file) => (
            <button className="bound-file" key={file.id} onClick={() => setPreview(file.id)}>
              <span className="bound-file-format">{file.format}</span>
              <span className="bound-file-copy">
                <b>{file.name}</b>
                <small>
                  {file.role} · {file.detail}
                </small>
              </span>
              <span className="bound-file-action">预览</span>
            </button>
          ))}
          {!files.length && (
            <div className="bound-files-empty">
              <b>尚未绑定文件</b>
              <small>可以先点击右上角“载入练习文件”，或从项目文件中心上传真实数据。</small>
            </div>
          )}
        </div>
      </section>
      {computeSupported && (
        <form
          className="analysis-form"
          onSubmit={(e) => {
            e.preventDefault();
            void post("run");
          }}
        >
          <section className="analysis-section analysis-design">
            <div className="analysis-section-head">
              <div className="analysis-step">
                <span>02</span>
                <div>
                  <h3>确认分析设计</h3>
                  <p>这些参数会直接进入设计矩阵和差异表达计算，请在运行前核对。</p>
                </div>
              </div>
              <span className={`analysis-section-state ${designReady ? "ready" : ""}`}>
                {designReady ? "字段已填写" : "待填写"}
              </span>
            </div>
            <div className="analysis-form-group">
              <div className="analysis-form-group-head">
                <b>数据角色</b>
                <small>选择要用于本次计算的真实文件</small>
              </div>
              <div className="analysis-config analysis-file-grid">
                {(
                  [
                    ["countsId", "Count 矩阵", selectedCountsFile],
                    ["metadataId", "样本元数据", selectedMetadataFile],
                  ] as const
                ).map(([key, label, selectedFile]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <SelectControl
                      required
                      value={config[key]}
                      onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                    >
                      <option value="">选择文件</option>
                      {files
                        .filter((f) => ["CSV", "TSV", "XLSX"].includes(f.format))
                        .map((file) => (
                          <option key={file.id} value={file.id}>
                            {file.name}
                          </option>
                        ))}
                    </SelectControl>
                    <small className="field-hint">
                      {selectedFile ? `${selectedFile.format} · ${selectedFile.status}` : "必填"}
                    </small>
                  </label>
                ))}
              </div>
            </div>
            <div className="analysis-form-group">
              <div className="analysis-form-group-head">
                <b>实验设计</b>
                <small>用于生成 condition 与 batch 关系</small>
              </div>
              <div className="analysis-config analysis-design-grid">
                {(
                  [
                    ["condition", "分组字段", "如 condition"],
                    ["control", "对照组", "如 control"],
                    ["treated", "处理组", "如 treated"],
                    ["batch", "批次字段（可选）", "没有批次可留空"],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <input
                      required={key !== "batch"}
                      placeholder={placeholder}
                      value={config[key]}
                      onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                    />
                  </label>
                ))}
                <label>
                  <span>FDR 阈值</span>
                  <input
                    type="number"
                    min="0.001"
                    max="0.999"
                    step="0.001"
                    value={config.alpha}
                    onChange={(e) => setConfig({ ...config, alpha: Number(e.target.value) })}
                  />
                  <small className="field-hint">默认 0.05</small>
                </label>
              </div>
            </div>
          </section>
          <section className="analysis-run-section">
            <div className="analysis-section-head">
              <div className="analysis-step">
                <span>03</span>
                <div>
                  <h3>校验并运行</h3>
                  <p>服务端会在本机 Worker 中执行 PyDESeq2，并持续回传作业状态。</p>
                </div>
              </div>
              <span className={`analysis-section-state ${readyToRun ? "ready" : ""}`}>
                {statusLabel}
              </span>
            </div>
            <div className="analysis-readiness">
              <span className={inputsReady ? "ready" : ""}>✓ 输入文件</span>
              <span className={designReady ? "ready" : ""}>✓ 实验设计</span>
              <span className={!blockedByTask ? "ready" : ""}>
                {blockedByTask ? "○ 等待计划确认" : "✓ 任务已解锁"}
              </span>
            </div>
            <button
              id="analysis-run"
              className="primary analysis-run-button"
              disabled={busy || !readyToRun}
            >
              {active ? "计算中…" : "运行 PyDESeq2"}
            </button>
          </section>
        </form>
      )}
      {error && (
        <p role="alert" className="document-error">
          {error}
        </p>
      )}
      {job && (
        <div className="real-job-status">
          <span>
            作业 {job.id.slice(0, 8)} · {job.status}
          </span>
          {active && (
            <button disabled={busy} onClick={() => void post("cancel")}>
              取消作业
            </button>
          )}
          {job.error && <p role="alert">{job.error}</p>}
        </div>
      )}
      {job?.result && (
        <section className="real-results">
          <h3>
            {job.result.engine} {job.result.version}
          </h3>
          <p>
            {job.result.sampleCount} 样本 · {job.result.summary.testedGeneCount} 检测基因 ·{" "}
            {job.result.summary.significantGeneCount} 显著基因 · {job.result.design}
          </p>
          {volcanoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={volcanoUrl} alt="根据上传 Count 矩阵计算的差异表达火山图" />
          ) : (
            <div className="real-result-loading">正在读取火山图产物…</div>
          )}
          <nav>
            {job.result.artifacts.map((name) => (
              <button
                key={name}
                onClick={() =>
                  void downloadAuthorizedFile(`/api/tasks/${task.id}/analysis/${name}`, name).catch(
                    (downloadError) =>
                      setError(
                        downloadError instanceof Error ? downloadError.message : "结果下载失败",
                      ),
                  )
                }
              >
                {name}
              </button>
            ))}
          </nav>
          <table>
            <thead>
              <tr>
                <th>基因</th>
                <th>log2FC</th>
                <th>padj</th>
              </tr>
            </thead>
            <tbody>
              {job.result.candidateGenes.map((gene) => (
                <tr key={gene.symbol}>
                  <td>{gene.symbol}</td>
                  <td>{gene.log2FoldChange.toFixed(3)}</td>
                  <td>{gene.fdr.toExponential(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {preview && <FilePreview fileId={preview} onClose={() => setPreview("")} />}
    </section>
  );
}
