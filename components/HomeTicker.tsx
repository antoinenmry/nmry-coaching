"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useData } from "@/components/DataProvider";
import Fireworks from "@/components/Fireworks";
import { DEFAULT_TICKER_SPEED } from "@/lib/carousel";

/** Élément du bandeau : texte fort, suite, pastille de date. */
type TickItem = { id: string; color: string; strong: string; rest?: string; when?: string; birthday?: boolean };
type FeedCard = { id: string; kind: string; title: string; rows?: { who: string; what: string; when: string }[] };

const ymd = (x: Date) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Bandeau d'infos de l'accueil (dans l'en-tête) : anniversaires, rappels, compétitions et
 * anniversaires à venir défilent en continu à vitesse constante (px/s, réglable par les éditeurs).
 * Le doigt posé ou la souris dessus l'arrête. Mouvement réduit : liste glissable, sans animation.
 */
export default function HomeTicker({ compact = false }: { compact?: boolean }) {
  const { me, state, activeUserId, library } = useData();
  const [feed, setFeed] = useState<FeedCard[]>([]);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    fetch("/api/home/feed")
      .then((r) => (r.ok ? r.json() : { cards: [] }))
      .then((d) => { if (!cancelled) setFeed(d.cards ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [me]);

  const hidden = new Set(library.carousel?.hidden ?? []);
  const items: TickItem[] = [];

  // 1) Anniversaires du jour
  if (!hidden.has("birthdays")) {
    for (const c of feed.filter((c) => c.kind === "birthday")) {
      items.push({ id: c.id, color: "#ffb300", strong: c.title, birthday: true });
    }
  }
  // 2) Rappels personnels (sur SES données, jamais sur le profil d'un sportif consulté)
  if (!hidden.has("reminders") && me && activeUserId === me.id) {
    const d = new Date();
    const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const today = ymd(d);
    const todays = state.sessions.filter((s) => s.date === today && !s.done);
    if (todays.length > 0) items.push({ id: "rem-today", color: "#42a5f5", strong: "Séance du jour", rest: todays.map((s) => s.name).join(", ") });
    for (const g of state.goals) {
      if (!g.date) continue;
      const n = Math.round((new Date(g.date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86_400_000);
      if (n >= 0 && n <= 7) items.push({ id: `rem-goal-${g.id}`, color: "#66bb6a", strong: n === 0 ? "C'est aujourd'hui" : `J-${n}`, rest: g.competition });
    }
  }
  // 3) Compétitions puis anniversaires à venir du groupe
  const lists: [string, string, string, boolean][] = [["list-goals", "goals-list", "#66bb6a", false], ["list-bdays", "bdays-list", "#ffb300", true]];
  for (const [cardId, slot, color, isBday] of lists) {
    if (hidden.has(slot)) continue;
    for (const [k, r] of (feed.find((c) => c.id === cardId)?.rows ?? []).entries()) {
      items.push({ id: `${cardId}-${k}`, color, strong: r.who, rest: isBday ? "anniversaire" : r.what, when: r.when });
    }
  }

  // Feu d'artifice : une fois par jour et par anniversaire, ou en touchant l'anniversaire.
  const [fireworks, setFireworks] = useState(false);
  const birthdayIds = items.filter((i) => i.birthday).map((i) => i.id).join(",");
  useEffect(() => {
    if (!birthdayIds) return;
    try {
      const k = `nmry_fireworks_${todayKey()}_${birthdayIds}`;
      if (localStorage.getItem(k)) return;
      localStorage.setItem(k, "1");
    } catch { /* stockage indisponible : on lance quand même */ }
    setFireworks(true);
  }, [birthdayIds]);

  // Vitesse constante : durée = largeur d'un tour / vitesse.
  const speed = Math.min(90, Math.max(15, library.carousel?.tickerSpeed ?? DEFAULT_TICKER_SPEED));
  const railRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const signature = items.map((i) => i.id + i.strong + (i.rest ?? "")).join("|");
  useLayoutEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const measure = () => setDuration(el.scrollWidth / 2 / speed);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [signature, speed]);

  const [paused, setPaused] = useState(false);
  const resumeRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hold = () => { clearTimeout(resumeRef.current); setPaused(true); };
  const release = (ms: number) => { clearTimeout(resumeRef.current); resumeRef.current = setTimeout(() => setPaused(false), ms); };
  useEffect(() => () => clearTimeout(resumeRef.current), []);

  if (items.length === 0) return null;

  const row = (copy: number) =>
    items.map((it) => (
      <span
        key={`${copy}-${it.id}`}
        onClick={it.birthday ? () => setFireworks(true) : undefined}
        className="inline-flex shrink-0 items-center gap-1.5 pr-3 text-[12.5px]"
      >
        <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: it.color }} />
        <b className="font-black">{it.strong}</b>
        {it.rest && <span className="text-dim">· {it.rest}</span>}
        {it.when && (
          <span
            className="rounded-full px-1.5 py-px text-[11px] font-black"
            style={{ background: `color-mix(in srgb, ${it.color} 20%, transparent)`, color: `color-mix(in srgb, ${it.color} 75%, var(--color-ink))` }}
          >
            {it.when}
          </span>
        )}
        <span aria-hidden className="pl-1.5 text-line">•</span>
      </span>
    ));

  return (
    <>
      {fireworks && <Fireworks onDone={() => setFireworks(false)} />}
      <div
        role="region"
        aria-label="Infos du groupe"
        onPointerDown={hold}
        onPointerUp={() => release(2500)}
        onPointerCancel={() => release(2500)}
        onMouseEnter={hold}
        onMouseLeave={() => release(0)}
        className={`nmry-ticker relative min-w-0 flex-1 overflow-hidden rounded-lg bg-surface2/70 ${compact ? "h-8" : "h-10"}`}
      >
        <div
          ref={railRef}
          className="nmry-ticker-rail absolute inset-y-0 left-0 flex items-center whitespace-nowrap"
          style={{
            animationDuration: duration ? `${duration}s` : undefined,
            animationPlayState: paused || !duration ? "paused" : "running",
          }}
        >
          {row(0)}
          <span aria-hidden className="nmry-ticker-dup contents">{row(1)}</span>
        </div>
      </div>
    </>
  );
}
