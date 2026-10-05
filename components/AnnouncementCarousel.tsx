"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useData } from "@/components/DataProvider";
import type { Announcement } from "@/lib/types";

const AUTO_MS = 5000; // défilement automatique toutes les 5 s

const todayKey = () => new Date().toISOString().slice(0, 10);
const normalizeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

/** Annonces actuellement affichables (non expirées). */
export function activeAnnouncements(list: Announcement[] | undefined): Announcement[] {
  const t = todayKey();
  return (list ?? []).filter((a) => !a.endDate || a.endDate >= t);
}

/**
 * Carrousel d'annonces de l'accueil : cartes en dégradé qui défilent seules toutes les
 * 5 s (pause pendant que le doigt touche la carte), glissables, avec points de progression.
 * Un tap copie le code promo (s'il y en a un) ou ouvre le lien.
 */
export default function AnnouncementCarousel() {
  const { library } = useData();
  const items = activeAnnouncements(library.announcements);
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const count = items.length;

  const goTo = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setIndex(i);
  }, []);

  // Défilement automatique (désactivé s'il n'y a qu'une carte)
  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => {
      if (pausedRef.current || document.hidden) return;
      goTo((index + 1) % count);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [count, index, goTo]);

  if (count === 0) return null;

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(Math.min(Math.max(i, 0), count - 1));
  }

  function activate(a: Announcement) {
    if (a.code) {
      navigator.clipboard?.writeText(a.code).catch(() => {});
      setCopied(a.id);
      setTimeout(() => setCopied(null), 2000);
    } else if (a.link) {
      window.open(normalizeUrl(a.link), "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="mb-3.5">
      <div
        ref={trackRef}
        onScroll={onScroll}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { setTimeout(() => { pausedRef.current = false; }, 4000); }}
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-[20px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((a) => {
          const actionable = !!(a.code || a.link);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => actionable && activate(a)}
              className="relative w-full shrink-0 snap-center overflow-hidden rounded-[20px] border px-4 py-3.5 text-left"
              style={{
                background: `linear-gradient(120deg, color-mix(in srgb, ${a.color} 32%, var(--color-surface)), var(--color-surface) 78%)`,
                borderColor: `color-mix(in srgb, ${a.color} 45%, transparent)`,
                cursor: actionable ? "pointer" : "default",
              }}
            >
              <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: a.color }} />
              {a.label && (
                <span className="block text-[10.5px] font-black uppercase tracking-[0.12em]" style={{ color: `color-mix(in srgb, ${a.color} 60%, var(--color-ink))` }}>
                  {a.label}
                </span>
              )}
              <span className="mt-0.5 block text-[17px] font-black leading-tight">{a.title}</span>
              {a.text && <span className="mt-1 block whitespace-pre-wrap text-[13px] leading-snug text-dim">{a.text}</span>}
              {a.code && (
                <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-line bg-black/25 px-3 py-1 text-[12px] font-black">
                  {a.code}
                  <span className="text-dim">{copied === a.id ? "copié" : "toucher pour copier"}</span>
                </span>
              )}
              {!a.code && a.link && <span className="mt-2 block text-[12px] font-black text-accent">Ouvrir le lien ›</span>}
            </button>
          );
        })}
      </div>
      {count > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {items.map((a, i) => (
            <button
              key={a.id}
              type="button"
              aria-label={`Annonce ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-[18px] bg-accent" : "w-1.5 bg-line"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
