export type DemoConfig = {
  workflowId: string;
  title: string;
  goal: string;
  domain: string;
  sampleCount: number;
  geneCount: number;
  failAt: "design" | "none";
  runnerDelayMs: number;
  codeChunkMs: number;
};

export const defaultDemoConfig: DemoConfig = {
  workflowId: "workflow_demo",
  title: "RNA-seq 差异表达分析",
  goal: "比较处理组与对照组，识别候选差异基因",
  domain: "bulk RNA-seq",
  sampleCount: 24,
  geneCount: 18432,
  failAt: "design",
  runnerDelayMs: 2500,
  codeChunkMs: 8,
};

export function normalizeDemoConfig(
  input: Partial<DemoConfig> = {},
): DemoConfig {
  const delay = Number(input.runnerDelayMs ?? defaultDemoConfig.runnerDelayMs);
  const chunk = Number(input.codeChunkMs ?? defaultDemoConfig.codeChunkMs);
  return {
    ...defaultDemoConfig,
    ...input,
    sampleCount: Math.max(
      1,
      Math.round(Number(input.sampleCount ?? defaultDemoConfig.sampleCount)),
    ),
    geneCount: Math.max(
      1,
      Math.round(Number(input.geneCount ?? defaultDemoConfig.geneCount)),
    ),
    runnerDelayMs: Math.min(
      12000,
      Math.max(
        500,
        Number.isFinite(delay) ? delay : defaultDemoConfig.runnerDelayMs,
      ),
    ),
    codeChunkMs: Math.min(
      80,
      Math.max(
        1,
        Number.isFinite(chunk) ? chunk : defaultDemoConfig.codeChunkMs,
      ),
    ),
    failAt: input.failAt === "none" ? "none" : "design",
  };
}
