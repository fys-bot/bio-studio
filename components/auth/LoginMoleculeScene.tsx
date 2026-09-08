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
      const centerX = compact ? width * 0.5 : width * 0.34;
      const amplitude = Math.min(width * (compact ? 0.24 : 0.13), 112);
      const step = Math.max(18, height / 30);
      const speed = frame * 0.012;
      const points: Array<{ y: number; left: number; right: number; phase: number }> = [];

      for (let y = -step; y < height + step; y += step) {
        const phase = y * 0.032 + speed;
        points.push({
          y,
          left: centerX + Math.sin(phase) * amplitude,
          right: centerX + Math.sin(phase + Math.PI) * amplitude,
          phase,
        });
      }

      const drawStrand = (side: "left" | "right", color: string) => {
        context.beginPath();
        points.forEach((point, index) => {
          const x = point[side];
          if (index === 0) context.moveTo(x, point.y);
          else context.lineTo(x, point.y);
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
        context.moveTo(point.left, point.y);
        context.lineTo(point.right, point.y);
        context.stroke();

        const radius = 2.6 + depth * 1.8;
        context.fillStyle = `rgba(42, 119, 94, ${0.38 + depth * 0.38})`;
        context.beginPath();
        context.arc(point.left, point.y, radius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = `rgba(151, 171, 25, ${0.4 + (1 - depth) * 0.34})`;
        context.beginPath();
        context.arc(point.right, point.y, radius, 0, Math.PI * 2);
        context.fill();

        if (index % 7 === 0) {
          const targetX = Math.min(point.left, point.right) - 12;
          const targetWidth = Math.abs(point.right - point.left) + 24;
          context.setLineDash([4, 4]);
          context.strokeStyle = "rgba(74, 112, 92, 0.2)";
          context.strokeRect(targetX, point.y - step * 0.35, targetWidth, step * 0.7);
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
