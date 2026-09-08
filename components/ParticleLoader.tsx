"use client";

import { useEffect, useRef } from "react";

const helixParticles = Array.from({ length: 46 }, (_, index) => {
  const ratio = index / 45;
  const phase = ratio * Math.PI * 5.2;
  return {
    id: index,
    left: `${ratio * 100}%`,
    firstTop: `${50 + Math.sin(phase) * 36}%`,
    secondTop: `${50 + Math.sin(phase + Math.PI) * 36}%`,
    delay: `${index * -0.035}s`,
  };
});

export function ParticleLoader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let animation = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particleCount = reducedMotion ? 90 : Math.min(220, Math.max(120, window.innerWidth / 6));
    const ambientParticles = Array.from({ length: particleCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      phase: Math.random() * Math.PI * 2,
      speed: 0.00008 + Math.random() * 0.00014,
      size: 0.5 + Math.random() * 1.4,
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
      const centerY = height * 0.41;
      const scale = Math.min(1.18, Math.max(0.62, Math.min(width, height) / 760));
      const span = Math.min(width * 0.82, 980);
      const amplitude = Math.min(height * 0.12, 92) * scale;
      context.clearRect(0, 0, width, height);

      ambientParticles.forEach((particle) => {
        const drift = reducedMotion ? 0 : time * particle.speed;
        const x = ((particle.x + drift) % 1) * width;
        const y = particle.y * height + Math.sin(time * 0.0005 + particle.phase) * 10;
        context.fillStyle = `rgba(43, 101, 76, ${0.08 + particle.size * 0.06})`;
        context.beginPath();
        context.arc(x, y, particle.size, 0, Math.PI * 2);
        context.fill();
      });

      const points = Math.max(72, Math.round(span / 7));
      const motion = reducedMotion ? 0 : time * 0.00105;
      for (let index = 0; index < points; index += 1) {
        const ratio = index / (points - 1);
        const phase = ratio * Math.PI * 5.2 + motion;
        const x = centerX - span / 2 + ratio * span;
        const strandAY = centerY + Math.sin(phase) * amplitude;
        const strandBY = centerY + Math.sin(phase + Math.PI) * amplitude;
        const depthA = (Math.cos(phase) + 1) / 2;
        const depthB = 1 - depthA;

        if (index % 7 === 0) {
          context.strokeStyle = `rgba(56, 103, 82, ${0.1 + Math.abs(Math.cos(phase)) * 0.12})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(x, strandAY);
          context.lineTo(x, strandBY);
          context.stroke();
        }

        context.fillStyle = `rgba(29, 103, 74, ${0.38 + depthA * 0.5})`;
        context.beginPath();
        context.arc(x, strandAY, 1.3 + depthA * 2.1, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = `rgba(139, 154, 19, ${0.32 + depthB * 0.62})`;
        context.beginPath();
        context.arc(x, strandBY, 1.3 + depthB * 2.1, 0, Math.PI * 2);
        context.fill();
      }

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
      <div className="particle-helix" aria-hidden="true">
        {helixParticles.map((particle) => (
          <span key={particle.id} className="particle-helix-column" style={{ left: particle.left }}>
            <i style={{ top: particle.firstTop, animationDelay: particle.delay }} />
            <i style={{ top: particle.secondTop, animationDelay: particle.delay }} />
          </span>
        ))}
      </div>
    </>
  );
}
