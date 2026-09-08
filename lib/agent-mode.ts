export type AgentMode = "快速模式" | "标准模式" | "深度研究";
export type ReasoningEffort = "low" | "medium" | "high";

export type AgentModeOption = {
  value: AgentMode;
  effort: ReasoningEffort;
  label: string;
  description: string;
};

export const DEFAULT_AGENT_MODE: AgentMode = "标准模式";

export const AGENT_MODE_OPTIONS: AgentModeOption[] = [
  {
    value: "快速模式",
    effort: "low",
    label: "快速模式",
    description: "适合字段确认和短问题，优先降低等待时间。",
  },
  {
    value: "标准模式",
    effort: "medium",
    label: "标准模式",
    description: "适合日常分析规划，平衡证据完整度与响应速度。",
  },
  {
    value: "深度研究",
    effort: "high",
    label: "深度研究",
    description: "适合复杂实验设计，强化假设、风险和证据边界检查。",
  },
];

export function normalizeAgentMode(value: unknown): AgentMode {
  return AGENT_MODE_OPTIONS.some((option) => option.value === value)
    ? (value as AgentMode)
    : DEFAULT_AGENT_MODE;
}

export function reasoningEffortForMode(mode: AgentMode): ReasoningEffort {
  return (
    AGENT_MODE_OPTIONS.find((option) => option.value === mode)?.effort ??
    reasoningEffortForMode(DEFAULT_AGENT_MODE)
  );
}

export function agentModeInstruction(mode: AgentMode) {
  if (mode === "快速模式") {
    return "Prefer a short executable plan. Resolve only blocking ambiguity and avoid optional branches.";
  }
  if (mode === "深度研究") {
    return "Inspect assumptions, confounders, evidence limitations and reproducibility risks before proposing steps.";
  }
  return "Balance execution speed with evidence quality, reproducibility and concise risk disclosure.";
}
