"use client";

import { useEffect, useRef } from "react";

export function ParticleLoader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let animation = 0;
    const particles = Array.from({ length: 1800 }, (_, index) => ({
      angle: (index / 1800) * Math.PI * 2,
      radius: 100 + Math.random() * 180,
      speed: 0.0007 + Math.random() * 0.0012,
      phase: Math.random() * Math.PI * 2,
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
      const glow = context.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        260 * scale,
      );
      glow.addColorStop(0, "rgba(18, 148, 108, .14)");
      glow.addColorStop(1, "rgba(4, 12, 10, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      particles.forEach((particle) => {
        const angle = particle.angle + time * particle.speed;
        const wave = Math.sin(time * 0.001 + particle.phase) * 14 * scale;
        const x = centerX + Math.cos(angle) * (particle.radius * scale + wave);
        const y = centerY + Math.sin(angle) * (particle.radius * scale) * 0.42;
        const alpha = 0.28 +
          ((Math.sin(angle * 3 + time * 0.002) + 1) / 2) * 0.68;
        context.fillStyle = `rgba(66, 236, 183, ${alpha})`;
        context.fillRect(x, y, 1.5 * scale, 1.5 * scale);
      });

      animation = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    animation = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="particle-loader" aria-hidden="true" />
  );
}
