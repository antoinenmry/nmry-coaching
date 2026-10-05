"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#ffc53d", "#ff9f00", "#ffffff", "#ff6b9d", "#7cc3f8", "#9be58f"];

/**
 * Feu d'artifice plein écran (canvas, ~4 s) pour célébrer un anniversaire.
 * Ne bloque aucun clic (pointer-events: none) ; ignoré si l'utilisateur a demandé
 * moins d'animations. `onDone` est appelé à la fin pour retirer le composant.
 */
export default function Fireworks({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { onDone(); return; }
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
    const parts: P[] = [];
    const burst = (x: number, y: number) => {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const n = 46;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        const sp = 1.6 + Math.random() * 3.2;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 55 + Math.random() * 25, color: Math.random() < 0.25 ? "#ffffff" : color, size: 1.6 + Math.random() * 1.6 });
      }
    };

    const start = performance.now();
    const DURATION = 4200;
    let nextBurst = 0, raf = 0;
    const tick = (now: number) => {
      const t = now - start;
      if (t >= nextBurst && t < DURATION - 1200) {
        burst(W * (0.15 + Math.random() * 0.7), H * (0.12 + Math.random() * 0.4));
        nextBurst = t + 450 + Math.random() * 350;
      }
      ctx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life++;
        p.vy += 0.045; p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx; p.y += p.vy;
        const alpha = Math.max(0, 1 - p.life / p.max);
        if (alpha <= 0) { parts.splice(i, 1); continue; }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (t < DURATION || parts.length > 0) raf = requestAnimationFrame(tick);
      else onDone();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[90] h-full w-full" />;
}
