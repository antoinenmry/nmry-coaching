"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useData } from "@/components/DataProvider";
import type { Announcement } from "@/lib/types";
import Fireworks from "@/components/Fireworks";

/** Carte affichable : annonce du coach, carte automatique (anniversaire, victoire) ou rappel. */
type Item = {
  id: string; label: string; title: string; text: string; color: string;
  code?: string; link?: string; poll?: { options: string[] };
};

const AUTO_MS = 5000; // défilement automatique toutes les 5 s

const todayKey = () => new Date().toISOString().slice(0, 10);
const normalizeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

/** Annonces actuellement affichables : non expirées et destinées à `userId` (ou à tous). */
export function activeAnnouncements(list: Announcement[] | undefined, userId?: string | null): Announcement[] {
  const t = todayKey();
  return (list ?? []).filter(
    (a) => (!a.endDate || a.endDate >= t) && (!a.targets?.length || (!!userId && a.targets.includes(userId))),
  );
}

/**
 * Carrousel d'annonces de l'accueil : cartes en dégradé qui défilent seules toutes les
 * 5 s (pause pendant que le doigt touche la carte), glissables, avec points de progression.
 * Un tap copie le code promo (s'il y en a un) ou ouvre le lien.
 */
export default function AnnouncementCarousel() {
  const { library, state, update, me, activeUserId } = useData();
  const [feed, setFeed] = useState<Item[]>([]);

  // Cartes automatiques du groupe (anniversaires, records, badges) — calculées côté serveur.
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    fetch("/api/home/feed")
      .then((r) => (r.ok ? r.json() : { cards: [] }))
      .then((d) => { if (!cancelled) setFeed(d.cards ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [me]);

  // Rappels personnels : calculés ici, sur SES données (jamais sur le profil d'un sportif consulté).
  const reminders: Item[] = [];
  if (me && activeUserId === me.id) {
    const today = todayKey();
    const d = new Date();
    const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    const todayLocal = key(d);
    const todo = state.sessions.filter((s) => s.date && !s.done && s.date >= todayLocal && s.date <= key(sun));
    const todays = todo.filter((s) => s.date === todayLocal);
    if (todays.length > 0) {
      reminders.push({ id: "rem-today", label: "Aujourd'hui", color: "#42a5f5", title: `Séance du jour : ${todays.map((s) => s.name).join(", ")}`, text: "Bonne séance !" });
    }
    for (const g of state.goals) {
      if (!g.date) continue;
      const n = Math.round((new Date(g.date + "T00:00:00").getTime() - new Date(todayLocal + "T00:00:00").getTime()) / 86_400_000);
      if (n >= 0 && n <= 7) {
        reminders.push({ id: `rem-goal-${g.id}`, label: "Objectif", color: "#66bb6a", title: n === 0 ? `C'est aujourd'hui : ${g.competition}` : `J-${n} · ${g.competition}`, text: g.place ?? "" });
      }
    }
    void today;
  }

  // Feu d'artifice : une fois par jour et par anniversaire, ou à chaque tap sur la carte.
  const [fireworks, setFireworks] = useState(false);
  const birthdayIds = feed.filter((c) => c.id.startsWith("bd-")).map((c) => c.id).join(",");
  useEffect(() => {
    if (!birthdayIds) return;
    try {
      const k = `nmry_fireworks_${todayKey()}_${birthdayIds}`;
      if (localStorage.getItem(k)) return;
      localStorage.setItem(k, "1");
    } catch { /* stockage indisponible : on lance quand même */ }
    setFireworks(true);
  }, [birthdayIds]);

  const items: Item[] = [
    ...feed.filter((c) => c.id.startsWith("bd-")),
    ...activeAnnouncements(library.announcements, me?.id),
    ...feed.filter((c) => !c.id.startsWith("bd-")),
    ...reminders,
  ];
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

  function activate(a: Item) {
    if (a.code) {
      navigator.clipboard?.writeText(a.code).catch(() => {});
      setCopied(a.id);
      setTimeout(() => setCopied(null), 2000);
    } else if (a.link) {
      window.open(normalizeUrl(a.link), "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="mb-3">
      {fireworks && <Fireworks onDone={() => setFireworks(false)} />}
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
          const myVote = state.pollVotes?.[a.id];
          return (
            <div
              key={a.id}
              role={actionable || a.id.startsWith("bd-") ? "button" : undefined}
              tabIndex={actionable ? 0 : undefined}
              onClick={() => { if (a.id.startsWith("bd-")) setFireworks(true); else if (actionable) activate(a); }}
              className="relative w-full shrink-0 snap-center overflow-hidden rounded-[20px] border px-4 py-3 text-left"
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
              {a.poll && (
                <span className="mt-2.5 flex flex-wrap gap-1.5">
                  {a.poll.options.map((o) => (
                    <button
                      key={o}
                      type="button"
                      disabled={activeUserId !== me?.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        update((d) => { (d.pollVotes ??= {})[a.id] = o; });
                      }}
                      className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-black transition active:scale-95 ${
                        myVote === o ? "border-transparent bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500]" : "border-line bg-black/25"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {count > 1 && (
        <div className="mt-1.5 flex justify-center gap-1.5">
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
