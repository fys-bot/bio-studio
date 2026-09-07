"use client";

import { useEffect, useRef } from "react";

type ParticleLoaderProps = { onSkip?: () => void };

export function ParticleLoader({ onSkip }: ParticleLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let animation = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particleCount = reducedMotion
      ? 220
      : Math.round(Math.min(1350, Math.max(420, window.innerWidth * 0.92)));
    const particles = Array.from({ length: particleCount }, (_, index) => ({
      angle: (index / particleCount) * Math.PI * 2,
      radius: 92 + Math.random() * 205,
      speed: 0.0008 + Math.random() * 0.0015,
      phase: Math.random() * Math.PI * 2,
      depth: 0.34 + Math.random() * 0.22,
      size: 0.9 + Math.random() * 1.9,
      highlighted: index % 9 === 0,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = (time: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const centerX = width / 2;
      const centerY = height * 0.42;
      const scale = Math.min(width, height) / 720;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = "rgba(55, 94, 75, .22)";
      context.lineWidth = 1.15;
      for (const radius of [108, 172, 242]) {
        context.beginPath();
        context.ellipse(centerX, centerY, radius * scale, radius * scale * 0.43, 0, 0, 7);
        context.stroke();
      }

      particles.forEach((particle) => {
        const angle = particle.angle + time * particle.speed;
        const wave = Math.sin(time * 0.0014 + particle.phase) * 18 * scale;
        const particleX = centerX + Math.cos(angle) * (particle.radius * scale + wave);
        const particleY = centerY + Math.sin(angle) * (particle.radius * scale) * particle.depth;
        const alpha = 0.38 + ((Math.sin(angle * 3 + time * 0.0024) + 1) / 2) * 0.5;
        const size = Math.max(1.25, particle.size * scale);
        context.fillStyle = particle.highlighted
          ? `rgba(126, 151, 6, ${Math.min(0.98, alpha + 0.08)})`
          : `rgba(36, 91, 67, ${alpha})`;
        context.beginPath();
        context.arc(particleX, particleY, size, 0, Math.PI * 2);
        context.fill();
      });

      const pulse = reducedMotion ? 0 : (Math.sin(time * 0.003) + 1) / 2;
      context.strokeStyle = `rgba(127, 151, 10, ${0.46 + pulse * 0.28})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(centerX, centerY, (24 + pulse * 5) * scale, 0, Math.PI * 2);
      context.stroke();

      if (!reducedMotion) animation = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    render(0);
    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="particle-loader" aria-hidden="true" />
      {onSkip && (
        <button className="boot-skip" onClick={onSkip}>
          跳过动画，继续加载
        </button>
      )}
    </>
  );
}
