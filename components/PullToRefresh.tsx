"use client";

import { useRef, useCallback, useEffect, useState } from "react";

const THRESHOLD = 120;  // px à tirer pour déclencher
const MAX_PULL  = 150;  // px max d'étirement visuel

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const startYRef   = useRef<number | null>(null);
  const pullingRef  = useRef(false);
  const [pull, setPull]       = useState(0);   // 0-MAX_PULL, pilote le visuel
  const [triggered, setTriggered] = useState(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    // N'active que si on est tout en haut de la page
    if (window.scrollY > 0) return;
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = false;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) { startYRef.current = null; return; }
    // On bloque le scroll natif seulement quand on tire vers le bas depuis le top
    if (window.scrollY === 0 && delta > 4) e.preventDefault();
    pullingRef.current = true;
    setPull(Math.min(delta, MAX_PULL));
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!pullingRef.current) return;
    const current = pull; // snapshot
    if (current >= THRESHOLD) {
      setTriggered(true);
      // Petite pause pour que l'animation soit visible avant le reload
      setTimeout(() => window.location.reload(), 300);
    } else {
      setPull(0);
    }
    startYRef.current  = null;
    pullingRef.current = false;
  }, [pull]);

  useEffect(() => {
    document.addEventListener("touchstart",  onTouchStart, { passive: true });
    document.addEventListener("touchmove",   onTouchMove,  { passive: false });
    document.addEventListener("touchend",    onTouchEnd,   { passive: true });
    return () => {
      document.removeEventListener("touchstart",  onTouchStart);
      document.removeEventListener("touchmove",   onTouchMove);
      document.removeEventListener("touchend",    onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  const progress = Math.min(pull / THRESHOLD, 1);
  const visible  = pull > 8;

  return (
    <>
      {/* Indicateur de pull — discret, centré en haut */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
          transform: `translateY(${visible ? Math.min(pull * 0.6, 52) : -40}px)`,
          transition: pull === 0 ? "transform 0.25s ease" : "none",
          opacity: visible ? Math.min(progress * 1.5, 1) : 0,
        }}
      >
        <div style={{
          background: "var(--color-surface2, #1c1c1e)",
          border: "1px solid var(--color-line, rgba(255,255,255,0.08))",
          borderRadius: "50%",
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}>
          <svg
            width="18" height="18" viewBox="0 0 18 18" fill="none"
            style={{
              transform: triggered
                ? "rotate(720deg)"
                : `rotate(${progress * 270}deg)`,
              transition: triggered ? "transform 0.4s ease" : "none",
            }}
          >
            <circle
              cx="9" cy="9" r="7"
              stroke="var(--color-accent, #6C63FF)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${progress * 35} 44`}
              fill="none"
            />
          </svg>
        </div>
      </div>

      {children}
    </>
  );
}
