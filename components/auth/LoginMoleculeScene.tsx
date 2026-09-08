"use client";

import { useEffect, useRef } from "react";

export function LoginMoleculeScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let animationFrame = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * ratio);
      canvas.height = Math.floor(canvas.clientHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      const compact = width < 760;
      const anchorX = compact ? width * 0.48 : width * 0.31;
      const anchorY = height * 0.5;
      const angle = compact ? -0.5 : -0.42;
      const axisX = Math.sin(angle);
      const axisY = Math.cos(angle);
      const normalX = Math.cos(angle);
      const normalY = -Math.sin(angle);
      const amplitude = Math.min(width * (compact ? 0.2 : 0.105), 94);
      const length = Math.hypot(width, height) * 1.16;
      const step = Math.max(20, length / 34);
      const speed = frame * 0.012;
      const points: Array<{
        left: { x: number; y: number };
        right: { x: number; y: number };
        center: { x: number; y: number };
        phase: number;
      }> = [];

      for (let distance = -length / 2; distance < length / 2 + step; distance += step) {
        const phase = distance * 0.034 + speed;
        const centerX = anchorX + axisX * distance;
        const centerY = anchorY + axisY * distance;
        const offset = Math.sin(phase) * amplitude;
        points.push({
          center: { x: centerX, y: centerY },
          left: { x: centerX + normalX * offset, y: centerY + normalY * offset },
          right: { x: centerX - normalX * offset, y: centerY - normalY * offset },
          phase,
        });
      }

      const drawStrand = (side: "left" | "right", color: string) => {
        context.beginPath();
        points.forEach((point, index) => {
          const position = point[side];
          if (index === 0) context.moveTo(position.x, position.y);
          else context.lineTo(position.x, position.y);
        });
        context.strokeStyle = color;
        context.lineWidth = compact ? 1.2 : 1.6;
        context.stroke();
      };

      drawStrand("left", "rgba(58, 125, 101, 0.28)");
      drawStrand("right", "rgba(135, 153, 29, 0.3)");

      points.forEach((point, index) => {
        const depth = (Math.sin(point.phase) + 1) / 2;
        context.strokeStyle = `rgba(72, 110, 92, ${0.08 + depth * 0.16})`;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(point.left.x, point.left.y);
        context.lineTo(point.right.x, point.right.y);
        context.stroke();

        const radius = 2.6 + depth * 1.8;
        context.fillStyle = `rgba(42, 119, 94, ${0.38 + depth * 0.38})`;
        context.beginPath();
        context.arc(point.left.x, point.left.y, radius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = `rgba(151, 171, 25, ${0.4 + (1 - depth) * 0.34})`;
        context.beginPath();
        context.arc(point.right.x, point.right.y, radius, 0, Math.PI * 2);
        context.fill();

        if (index % 7 === 0) {
          context.setLineDash([4, 4]);
          context.strokeStyle = "rgba(74, 112, 92, 0.2)";
          context.beginPath();
          context.moveTo(
            point.left.x - normalX * 10 - axisX * step * 0.35,
            point.left.y - normalY * 10 - axisY * step * 0.35,
          );
          context.lineTo(
            point.right.x + normalX * 10 - axisX * step * 0.35,
            point.right.y + normalY * 10 - axisY * step * 0.35,
          );
          context.lineTo(
            point.right.x + normalX * 10 + axisX * step * 0.35,
            point.right.y + normalY * 10 + axisY * step * 0.35,
          );
          context.lineTo(
            point.left.x - normalX * 10 + axisX * step * 0.35,
            point.left.y - normalY * 10 + axisY * step * 0.35,
          );
          context.closePath();
          context.stroke();
          context.setLineDash([]);
        }
      });

      const orbitX = compact ? width * 0.78 : width * 0.67;
      const orbitY = height * 0.24;
      [34, 58, 82].forEach((radius, index) => {
        context.strokeStyle = `rgba(51, 112, 91, ${0.13 - index * 0.025})`;
        context.beginPath();
        context.ellipse(orbitX, orbitY, radius, radius * 0.62, -0.38, 0, Math.PI * 2);
        context.stroke();
        const angle = speed * (1.3 - index * 0.2) + index * 2.1;
        context.fillStyle = index === 1 ? "rgba(153, 173, 30, 0.68)" : "rgba(43, 122, 96, 0.62)";
        context.beginPath();
        context.arc(
          orbitX + Math.cos(angle) * radius,
          orbitY + Math.sin(angle) * radius * 0.62,
          3.2,
          0,
          Math.PI * 2,
        );
        context.fill();
      });
      frame += 1;
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    draw();
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="login-molecule-scene" aria-hidden="true" />;
}
