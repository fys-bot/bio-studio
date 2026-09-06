import type { WorkflowLayoutSnapshot, WorkflowPosition } from "./domain";

export type WorkflowLayoutInput = {
  nodePositions?: Record<string, WorkflowPosition>;
  extraEdges?: string[][];
  zoom?: number;
  pan?: WorkflowPosition;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const finiteNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const normalizePosition = (
  position: Partial<WorkflowPosition> | undefined,
  fallback: WorkflowPosition,
): WorkflowPosition => ({
  x: clamp(finiteNumber(position?.x, fallback.x), -2_000, 2_000),
  y: clamp(finiteNumber(position?.y, fallback.y), -2_000, 2_000),
});

export const createDefaultWorkflowLayout = (): WorkflowLayoutSnapshot => ({
  nodePositions: {},
  extraEdges: [],
  zoom: 1,
  pan: { x: 0, y: 0 },
  revision: 0,
  updatedAt: new Date().toISOString(),
});

/**
 * 服务端统一约束画布坐标、缩放和连线，避免异常客户端把不可恢复布局写入任务状态。
 */
export function normalizeWorkflowLayout(
  input: WorkflowLayoutInput,
  previousLayout: WorkflowLayoutSnapshot,
): WorkflowLayoutSnapshot {
  const normalizedPositions = Object.fromEntries(
    Object.entries(input.nodePositions ?? previousLayout.nodePositions)
      .slice(0, 100)
      .map(([nodeId, position]) => [
        nodeId.slice(0, 80),
        normalizePosition(position, { x: 0, y: 0 }),
      ]),
  );
  const uniqueEdges = new Map<string, string[]>();

  for (const edge of (input.extraEdges ?? previousLayout.extraEdges).slice(0, 50)) {
    if (edge.length !== 2) continue;
    const [sourceNodeId, targetNodeId] = edge;
    if (
      typeof sourceNodeId !== "string" ||
      typeof targetNodeId !== "string" ||
      !sourceNodeId ||
      !targetNodeId ||
      sourceNodeId === targetNodeId
    ) {
      continue;
    }
    const normalizedEdge = [sourceNodeId.slice(0, 80), targetNodeId.slice(0, 80)];
    uniqueEdges.set(normalizedEdge.join("→"), normalizedEdge);
  }

  return {
    nodePositions: normalizedPositions,
    extraEdges: [...uniqueEdges.values()],
    zoom: clamp(finiteNumber(input.zoom, previousLayout.zoom), 0.55, 1.6),
    pan: normalizePosition(input.pan, previousLayout.pan),
    revision: previousLayout.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}
