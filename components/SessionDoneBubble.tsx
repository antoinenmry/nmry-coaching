"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/components/DataProvider";
import type { ExerciseInstance, SessionInstance } from "@/lib/types";

/**
 * Bulle « Séance validée » : noire, elle naît du haut de l'écran (comme l'encoche), s'ouvre,
 * reste ~5 s puis y retourne. Un toucher ouvre la programmation.
 * Déclenchée quand le sportif valide une séance sur SON profil (done : false → true).
 */

const OPEN_DELAY = 450;
const STAY_MS = 5200;
const R = 21;
const CIRC = 2 * Math.PI * R;

const touched = (ex: ExerciseInstance) =>
  !ex.failed && ((ex.weightClient ?? 0) > 0 || ex.rpeClient > 0 || (ex.setLogs ?? []).some((l) => l.w > 0 || l.r > 0));

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Shown = { title: string; sub: string; week: string; color: string; ratio: number; sessionColor: string; weekDone: boolean };

function describe(s: SessionInstance, all: SessionInstance[]): Shown {
  // Semaine du lundi au dimanche autour de la séance.
  const day = s.date ? new Date(s.date + "T12:00:00") : new Date();
  const mon = new Date(day); mon.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const inWeek = all.filter((x) => x.date && x.date >= key(mon) && x.date <= key(sun));
  const planned = Math.max(inWeek.length, 1);
  const done = inWeek.filter((x) => x.done).length;

  const total = s.exercises.length;
  const made = s.exercises.filter(touched).length;
  const complete = total === 0 || made >= total;
  const weekDone = inWeek.length > 0 && done >= inWeek.length;

  if (weekDone) {
    return { title: "Semaine bouclée, chapeau !", sub: `${s.name}, ${done} séance${done > 1 ? "s" : ""} sur ${planned}`, week: `${done}/${planned}`, color: "#1fd38a", ratio: 1, sessionColor: s.color, weekDone };
  }
  if (complete) {
    return { title: "Bravo ! Tu as validé ta séance.", sub: `${s.name}${total ? `, ${total} exercice${total > 1 ? "s" : ""} faits` : ""}`, week: `${done}/${planned}`, color: "#1fd38a", ratio: 1, sessionColor: s.color, weekDone };
  }
  return { title: "Séance faite, même plus courte : ça compte.", sub: `${s.name}, ${made} exercice${made > 1 ? "s" : ""} sur ${total}`, week: `${done}/${planned}`, color: "#f6c46a", ratio: made / total, sessionColor: s.color, weekDone };
}

export default function SessionDoneBubble() {
  const router = useRouter();
  const { loading, me, activeUserId, state } = useData();
  const prev = useRef<{ user: string | null; done: Map<string, boolean> }>({ user: null, done: new Map() });
  const [shown, setShown] = useState<Shown | null>(null);
  const [open, setOpen] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);

  const own = !loading && !!me && activeUserId === me.id;

  useEffect(() => {
    if (!own) { prev.current = { user: null, done: new Map() }; return; }
    const snapshot = new Map(state.sessions.map((s) => [s.id, s.done]));
    // Premier passage (ou changement de profil) : on mémorise l'état sans rien afficher.
    if (prev.current.user !== activeUserId) { prev.current = { user: activeUserId, done: snapshot }; return; }
    const justDone = state.sessions.filter((s) => s.done && prev.current.done.get(s.id) === false);
    prev.current = { user: activeUserId, done: snapshot };
    if (justDone.length === 0) return;

    clear();
    setShown(describe(justDone[justDone.length - 1], state.sessions));
    setOpen(false);
    timers.current.push(setTimeout(() => setOpen(true), OPEN_DELAY));
    timers.current.push(setTimeout(() => setOpen(false), OPEN_DELAY + STAY_MS));
    timers.current.push(setTimeout(() => setShown(null), OPEN_DELAY + STAY_MS + 800));
  }, [own, activeUserId, state.sessions]);

  if (!shown) return null;
  return (
    <button
      type="button"
      aria-live="polite"
      aria-label="Séance validée, ouvrir la programmation"
      onClick={() => { clear(); setOpen(false); router.push("/plan"); setTimeout(() => setShown(null), 600); }}
      className="fixed left-1/2 z-[70] -translate-x-1/2 overflow-hidden bg-[#05090d] text-white shadow-[0_14px_40px_-12px_rgba(0,0,0,0.7)] transition-[width,height,top,border-radius] duration-[550ms] ease-[cubic-bezier(.34,1.36,.5,1)] motion-reduce:transition-none"
      style={{
        top: open ? "calc(env(safe-area-inset-top, 0px) + 9px)" : "calc(env(safe-area-inset-top, 0px) + 11px)",
        width: open ? "min(370px, calc(100vw - 20px))" : 122,
        height: open ? 78 : 35,
        borderRadius: open ? 40 : 20,
      }}
    >
      <span
        className="absolute inset-0 flex items-center gap-3 pl-3.5 pr-[18px] text-left"
        style={{ opacity: open ? 1 : 0, transition: open ? "opacity .3s ease .22s" : "opacity .2s ease" }}
      >
        <span className="relative h-[50px] w-[50px] shrink-0">
          <svg viewBox="0 0 50 50" aria-hidden className="block h-full w-full -rotate-90">
            <circle cx="25" cy="25" r={R} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="4.5" />
            <circle
              cx="25" cy="25" r={R} fill="none" stroke={shown.color} strokeWidth="4.5" strokeLinecap="round"
              strokeDasharray={`${open ? CIRC * shown.ratio : 0} 200`}
              style={{ transition: "stroke-dasharray .9s cubic-bezier(.2,0,0,1) .35s" }}
            />
          </svg>
          <span className="absolute inset-[9px] grid place-items-center rounded-full" style={{ background: shown.sessionColor || "#c4480c" }}>
            <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[15px] font-semibold leading-tight">{shown.title}</b>
          <small className="mt-[3px] block truncate text-[12px] leading-tight text-white/65">{shown.sub}</small>
        </span>
        <span className="shrink-0 text-right">
          <b className="block text-[24px] font-black leading-none tabular-nums" style={{ color: shown.color }}>{shown.week}</b>
          <small className="text-[11px] text-white/60">semaine</small>
        </span>
      </span>
    </button>
  );
}
