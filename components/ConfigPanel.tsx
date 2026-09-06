"use client";

import { DemoConfig } from "@/lib/demo-config";

type Props = {
  config: DemoConfig;
  onChange: (config: DemoConfig) => void;
  onSave: () => void;
  onClose: () => void;
  saving?: boolean;
};

export function ConfigPanel(
  { config, onChange, onSave, onClose, saving = false }: Props,
) {
  const update = <K extends keyof DemoConfig>(key: K, value: DemoConfig[K]) =>
    onChange({ ...config, [key]: value });
  return (
    <div className="config-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="config-panel"
        role="dialog"
        aria-modal="true"
        aria-label="演示配置"
        onMouseDown={(event) =>
          event.stopPropagation()}
      >
        <header className="config-panel-head">
          <div>
            <small>可配置演示引擎</small>
            <h2>工作流参数</h2>
          </div>
          <button onClick={onClose} aria-label="关闭配置">×</button>
        </header>
        <p className="config-lead">
          修改配置后重新运行，页面会通过真实 API
          读取同一份服务端配置，方便面试现场演示不同业务分支。
        </p>
        <label>
          工作流名称<input
            value={config.title}
            onChange={(event) =>
              update("title", event.target.value)}
          />
        </label>
        <label>
          研究目标<input
            value={config.goal}
            onChange={(event) =>
              update("goal", event.target.value)}
          />
        </label>
        <div className="config-grid">
          <label>
            样本数<input
              type="number"
              min="1"
              value={config.sampleCount}
              onChange={(event) =>
                update("sampleCount", Number(event.target.value))}
            />
          </label>
          <label>
            基因数<input
              type="number"
              min="1"
              value={config.geneCount}
              onChange={(event) =>
                update("geneCount", Number(event.target.value))}
            />
          </label>
          <label>
            失败节点<select
              value={config.failAt}
              onChange={(event) =>
                update("failAt", event.target.value as DemoConfig["failAt"])}
            >
              <option value="design">设计矩阵（演示恢复）</option>
              <option value="none">不失败（演示成功链路）</option>
            </select>
          </label>
          <label>
            运行等待（毫秒）<input
              type="number"
              min="500"
              max="12000"
              step="500"
              value={config.runnerDelayMs}
              onChange={(event) =>
                update("runnerDelayMs", Number(event.target.value))}
            />
          </label>
        </div>
        <div className="config-note">
          <span>●</span> 当前配置只影响演示数据，不会向外部传输研究文件。
        </div>
        <footer className="config-actions">
          <button className="secondary" onClick={onClose}>取消</button>
          <button className="primary" onClick={onSave} disabled={saving}>
            {saving ? "保存中…" : "保存并应用"}
          </button>
        </footer>
      </section>
    </div>
  );
}
