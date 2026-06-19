"use client";

import { useRef, useCallback, useEffect, useState } from "react";

const THRESHOLD = 120;  // px à tirer pour ARMER le maintien (volontaire, pas un simple scroll)
const HOLD_MS   = 800;  // durée de maintien requise AU-DELÀ du seuil avant de pouvoir relâcher
const MAX_PULL  = 150;  // px max d'étirement visuel

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const startYRef    = useRef<number | null>(null);
  const pullingRef   = useRef(false);
  const crossedAtRef = useRef<number | null>(null); // timestamp du franchissement du seuil
  const armedRef     = useRef(false);               // true = maintien terminé, relâcher rafraîchit
  const rafRef       = useRef<number | null>(null);

  const [pull, setPull]                 = useState(0);   // 0-MAX_PULL, pilote l'étirement visuel
  const [holdProgress, setHoldProgress] = useState(0);   // 0-1, avancée du maintien
  const [armed, setArmed]               = useState(false);
  const [triggered, setTriggered]       = useState(false);

  const resetHold = useCallback(() => {
    crossedAtRef.current = null;
    armedRef.current = false;
    setArmed(false);
    setHoldProgress(0);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Boucle qui fait avancer la jauge de maintien tant que le doigt reste sous le seuil.
  const startHoldLoop = useCallback(() => {
    const tick = () => {
      if (crossedAtRef.current === null) return;
      const prog = Math.min((Date.now() - crossedAtRef.current) / HOLD_MS, 1);
      setHoldProgress(prog);
      if (prog >= 1) {
        armedRef.current = true;
        setArmed(true);
        rafRef.current = null;
        return; // maintien terminé → armé
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY > 0) return; // n'active qu'en tout haut de page
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = false;
    resetHold();
  }, [resetHold]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) { startYRef.current = null; resetHold(); setPull(0); return; }
    if (window.scrollY === 0 && delta > 4) e.preventDefault();
    pullingRef.current = true;
    setPull(Math.min(delta, MAX_PULL));

    if (delta >= THRESHOLD) {
      // Premier franchissement → démarre le compte du maintien
      if (crossedAtRef.current === null) {
        crossedAtRef.current = Date.now();
        startHoldLoop();
      }
    } else {
      // Repassé sous le seuil → on annule le maintien (il faut recommencer)
      if (crossedAtRef.current !== null) resetHold();
    }
  }, [resetHold, startHoldLoop]);

  const onTouchEnd = useCallback(() => {
    if (!pullingRef.current) { resetHold(); return; }
    if (armedRef.current) {
      setTriggered(true);
      setTimeout(() => window.location.reload(), 300);
    } else {
      setPull(0);
      resetHold();
    }
    startYRef.current = null;
    pullingRef.current = false;
  }, [resetHold]);

  useEffect(() => {
    document.addEventListener("touchstart",  onTouchStart, { passive: true });
    document.addEventListener("touchmove",   onTouchMove,  { passive: false });
    document.addEventListener("touchend",    onTouchEnd,   { passive: true });
    return () => {
      document.removeEventListener("touchstart",  onTouchStart);
      document.removeEventListener("touchmove",   onTouchMove);
      document.removeEventListener("touchend",    onTouchEnd);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  // Avant le seuil : la jauge suit le tirage. Au-delà : elle suit le maintien.
  const pastThreshold = pull >= THRESHOLD;
  const ringProgress  = pastThreshold ? holdProgress : Math.min(pull / THRESHOLD, 1);
  const visible       = pull > 8;
  const ringColor     = armed ? "var(--color-ok, #34c759)" : "var(--color-accent, #6C63FF)";

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
          transform: `translateY(${visible ? Math.min(pull * 0.5, 56) : -40}px)`,
          transition: pull === 0 ? "transform 0.25s ease" : "none",
          opacity: visible ? Math.min((pull / THRESHOLD) * 1.5, 1) : 0,
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
                : armed
                  ? "rotate(0deg)"
                  : `rotate(${ringProgress * 270}deg)`,
              transition: triggered ? "transform 0.4s ease" : "none",
            }}
          >
            <circle
              cx="9" cy="9" r="7"
              stroke={ringColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${ringProgress * 44} 44`}
              fill="none"
            />
          </svg>
        </div>
      </div>

      {children}
    </>
  );
}
