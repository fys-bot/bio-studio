"use client";
import { useEffect, useState } from "react";
import type { ProjectFileRecord, ResearchTask } from "@/lib/domain";
import type { AnalysisJob } from "@/lib/research-service";
import { bioflowApi } from "@/lib/api-client";
import { FilePreview } from "./FilePreview";

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
        const res = await fetch(`/api/tasks/${task.id}/analysis`);
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
      const res = await fetch(`/api/tasks/${task.id}/analysis`, {
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
  const active = job && ["queued", "running"].includes(job.status);
  const computeSupported = !task.skill || task.skill.id === "rnaseq-deseq2";
  return (
    <section className="real-analysis" id="real-analysis">
      <header>
        <div>
          <small>
            {task.skill ? `${task.skill.name} · v${task.skill.version}` : "真实数据分析"}
          </small>
          <h2>{computeSupported ? "输入与计算" : "任务文件与技能配置"}</h2>
        </div>
        {computeSupported && (
          <button disabled={busy} onClick={() => void post("samples")}>
            载入练习文件
          </button>
        )}
      </header>
      {task.skill && (
        <p className="bound-skill">
          输入：{task.skill.inputs.join("、")} · 输出：{task.skill.outputs.join("、")}
        </p>
      )}
      <div className="bound-files">
        {files.map((file) => (
          <button key={file.id} onClick={() => setPreview(file.id)}>
            {file.format} · {file.name}
          </button>
        ))}
        {!files.length && <p>尚未绑定文件</p>}
      </div>
      {computeSupported && (
        <form
          className="analysis-config"
          onSubmit={(e) => {
            e.preventDefault();
            void post("run");
          }}
        >
          {(
            [
              ["countsId", "Count 矩阵"],
              ["metadataId", "样本元数据"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <select
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
              </select>
            </label>
          ))}
          {(
            [
              ["condition", "分组字段"],
              ["control", "对照组"],
              ["treated", "处理组"],
              ["batch", "批次字段（可选）"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                required={key !== "batch"}
                value={config[key]}
                onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
              />
            </label>
          ))}
          <label>
            FDR 阈值
            <input
              type="number"
              min="0.001"
              max="0.999"
              step="0.001"
              value={config.alpha}
              onChange={(e) => setConfig({ ...config, alpha: Number(e.target.value) })}
            />
          </label>
          <button
            id="analysis-run"
            className="primary"
            disabled={
              busy ||
              Boolean(active) ||
              ["draft", "clarifying", "awaiting_approval"].includes(task.status)
            }
          >
            {active ? "计算中…" : "运行 PyDESeq2"}
          </button>
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/tasks/${task.id}/analysis/volcano.png`}
            alt="根据上传 Count 矩阵计算的差异表达火山图"
          />
          <nav>
            {job.result.artifacts.map((name) => (
              <a key={name} href={`/api/tasks/${task.id}/analysis/${name}`}>
                {name}
              </a>
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
