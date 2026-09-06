"use client";

import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  functionalResidues,
  structurePoints,
  type ProjectedStructurePoint,
} from "@/lib/structure-model";

type ProteinStructureRendererOptions = {
  autoRotate: boolean;
  hoveredResidue: number | null;
  selectedResidue: number | null;
  onHoverResidue: (residueNumber: number | null) => void;
  onSelectResidue: (residueNumber: number) => void;
};

/**
 * Canvas 三维渲染适配器：只负责坐标投影、绘制、相机控制和残基拾取。
 * 业务组件不依赖这套实现，因此可将本 Hook 替换为 Mol* / 3Dmol.js 适配器。
 */
export function useProteinStructureRenderer({
  autoRotate,
  hoveredResidue,
  selectedResidue,
  onHoverResidue,
  onSelectResidue,
}: ProteinStructureRendererOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const projectedPointsRef = useRef<ProjectedStructurePoint[]>([]);
  const rotationRef = useRef({ yaw: 0.45, pitch: -0.28 });
  const zoomRef = useRef(1);
  const dragRef = useRef({ active: false, moved: false, x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    const drawStructure = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      if (canvas.width !== width * pixelRatio || canvas.height !== height * pixelRatio) {
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      if (autoRotate && !dragRef.current.active) rotationRef.current.yaw += 0.0025;

      const { yaw, pitch } = rotationRef.current;
      const scale = Math.min(width, height) * 0.105 * zoomRef.current;
      const projectedPoints = structurePoints.map((point) => {
        const rotatedX = point.x * Math.cos(yaw) - point.z * Math.sin(yaw);
        const yawDepth = point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
        const rotatedY = point.y * Math.cos(pitch) - yawDepth * Math.sin(pitch);
        const depth = point.y * Math.sin(pitch) + yawDepth * Math.cos(pitch);
        return {
          ...point,
          screenX: width / 2 + rotatedX * scale,
          screenY: height / 2 + rotatedY * scale,
          depth,
        };
      });
      projectedPointsRef.current = projectedPoints;

      context.lineCap = "round";
      for (let pointIndex = 1; pointIndex < projectedPoints.length; pointIndex += 1) {
        const previousPoint = projectedPoints[pointIndex - 1];
        const currentPoint = projectedPoints[pointIndex];
        const depthTone = Math.round(125 + (currentPoint.depth + 3) * 12);
        context.beginPath();
        context.moveTo(previousPoint.screenX, previousPoint.screenY);
        context.lineTo(currentPoint.screenX, currentPoint.screenY);
        context.lineWidth = 4.4;
        context.strokeStyle = `rgba(55, ${Math.min(185, depthTone)}, 145, 0.68)`;
        context.stroke();
      }

      [...projectedPoints]
        .sort((firstPoint, secondPoint) => firstPoint.depth - secondPoint.depth)
        .forEach((point) => {
          const isSelected = point.residueNumber === selectedResidue;
          const isHovered = point.residueNumber === hoveredResidue;
          const isFunctional = functionalResidues.has(point.residueNumber);
          const radius = isSelected ? 7 : isHovered ? 6 : isFunctional ? 4.4 : 2.8;
          context.beginPath();
          context.arc(point.screenX, point.screenY, radius, 0, Math.PI * 2);
          context.fillStyle = isSelected
            ? "#d8ef4f"
            : isHovered
              ? "#f2f5cf"
              : isFunctional
                ? "#bdcd35"
                : "#6fcbb2";
          context.fill();
          if (isSelected || isHovered) {
            context.lineWidth = 2;
            context.strokeStyle = "#34421c";
            context.stroke();
          }
        });

      animationFrame = window.requestAnimationFrame(drawStructure);
    };
    animationFrame = window.requestAnimationFrame(drawStructure);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [autoRotate, hoveredResidue, selectedResidue]);

  const findResidueAtPoint = (clientX: number, clientY: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    const pointerX = clientX - bounds.left;
    const pointerY = clientY - bounds.top;
    return (
      projectedPointsRef.current
        .map((point) => ({
          point,
          distance: Math.hypot(point.screenX - pointerX, point.screenY - pointerY),
        }))
        .filter((candidate) => candidate.distance <= 10)
        .sort(
          (firstCandidate, secondCandidate) =>
            firstCandidate.distance - secondCandidate.distance,
        )[0]?.point || null
    );
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      active: true,
      moved: false,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.active) {
      const deltaX = event.clientX - dragRef.current.x;
      const deltaY = event.clientY - dragRef.current.y;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 2) dragRef.current.moved = true;
      rotationRef.current.yaw += deltaX * 0.012;
      rotationRef.current.pitch = Math.max(
        -1.35,
        Math.min(1.35, rotationRef.current.pitch + deltaY * 0.012),
      );
      dragRef.current.x = event.clientX;
      dragRef.current.y = event.clientY;
      return;
    }
    onHoverResidue(findResidueAtPoint(event.clientX, event.clientY)?.residueNumber || null);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.moved) {
      const residue = findResidueAtPoint(event.clientX, event.clientY);
      if (residue) onSelectResidue(residue.residueNumber);
    }
    dragRef.current.active = false;
  };

  const handlePointerLeave = () => {
    dragRef.current.active = false;
    onHoverResidue(null);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    zoomRef.current = Math.max(
      0.65,
      Math.min(1.8, zoomRef.current + (event.deltaY < 0 ? 0.08 : -0.08)),
    );
  };

  const resetView = () => {
    rotationRef.current = { yaw: 0.45, pitch: -0.28 };
    zoomRef.current = 1;
    onHoverResidue(null);
  };

  return {
    canvasRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    handleWheel,
    resetView,
  };
}
