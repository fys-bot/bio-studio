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
      const centerX = width * 0.35;
      const amplitude = Math.min(width * 0.16, 110);
      const step = Math.max(18, height / 28);
      for (let y = -step; y < height + step; y += step) {
        const phase = y * 0.035 + frame * 0.015;
        const x1 = centerX + Math.sin(phase) * amplitude;
        const x2 = centerX + Math.sin(phase + Math.PI) * amplitude;
        context.strokeStyle = "rgba(64, 116, 91, 0.13)";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x1, y);
        context.lineTo(x2, y);
        context.stroke();
        context.fillStyle = "rgba(137, 157, 29, 0.66)";
        context.beginPath();
        context.arc(x1, y, 3.2, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "rgba(50, 119, 101, 0.58)";
        context.beginPath();
        context.arc(x2, y, 3.2, 0, Math.PI * 2);
        context.fill();
      }
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
