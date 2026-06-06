"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";
import { createClient } from "@/lib/supabase/client";
import { daysUntil, countdownLabel } from "@/lib/dates";
import type { AppState, ChatMessage, ExerciseLibrary } from "@/lib/types";

const CARDS = [
  { href: "/profile", icon: "👤", label: "Mon Profil", color: "var(--color-accent)" },
  { href: "/plan", icon: "🗓️", label: "Programmation", color: "var(--color-accent2)" },
  { href: "/goals", icon: "🎯", label: "Mes Objectifs", color: "var(--color-ok)" },
  { href: "/records", icon: "🏆", label: "Mes Records", color: "var(--color-accent)" },
  { href: "/followup", icon: "📝", label: "Mon Suivi", color: "var(--color-danger)" },
  { href: "/library", icon: "📚", label: "Ma Bibliothèque", color: "var(--color-accent)" },
];

// ─── Helpers info dynamique cartes ──────────────────────────────────────────

function getWeekBounds(): [string, string] {
  const d = new Date();
  const day = d.getDay(); // 0 = Dim
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return [fmt(mon), fmt(sun)];
}

function getCardInfo(
  href: string,
  state: AppState,
  library: ExerciseLibrary,
  today: string,
): string | null {
  const mode = state.preferences?.cardInfoMode?.[href] ?? "hidden";
  if (mode === "hidden") return null;

  switch (href) {
    case "/plan": {
      const upcoming = state.sessions
        .filter((s) => s.date && s.date >= today)
        .sort((a, b) => a.date!.localeCompare(b.date!));
      if (mode === "nextSession") return upcoming[0]?.name ?? "Aucune séance prévue";
      if (mode === "weekPct") {
        const [mon, sun] = getWeekBounds();
        const week = state.sessions.filter((s) => s.date && s.date >= mon && s.date <= sun);
        if (!week.length) return "0 séance cette semaine";
        const done = week.filter((s) => s.done).length;
        return `${Math.round((done / week.length) * 100)}% réalisées cette semaine`;
      }
      if (mode === "remaining") {
        const n = upcoming.length;
        return n === 0 ? "Aucune séance prévue" : `${n} séance${n > 1 ? "s" : ""} à venir`;
      }
      return null;
    }
    case "/records": {
      if (mode === "lastRecord") {
        let latest: { date: string; name: string; weight: number; reps: number } | null = null;
        for (const ex of state.records.strength) {
          for (const entry of ex.entries) {
            if (!latest || entry.date > latest.date)
              latest = { date: entry.date, name: ex.name ?? ex.exId, weight: entry.weight, reps: entry.reps };
          }
        }
        if (!latest) return "Aucun record enregistré";
        return `${latest.name} · ${latest.weight} kg × ${latest.reps}`;
      }
      if (mode === "chosenRecord") {
        const exId = state.preferences?.chosenRecordExerciseId;
        if (!exId) return "→ Choisir un exercice (Settings)";
        const exRec = state.records.strength.find((e) => e.exId === exId);
        if (!exRec?.entries.length) return exRec?.name ?? exId;
        const best = [...exRec.entries].sort((a, b) => b.weight - a.weight)[0];
        return `${exRec.name ?? exId} · ${best.weight} kg × ${best.reps}`;
      }
      return null;
    }
    case "/followup": {
      if (mode === "activeInjury") {
        const injury = state.followups.find((f) => f.type === "injury" && !f.dateEnd);
        return injury ? `🤕 ${injury.text}` : "Aucune blessure active";
      }
      if (mode === "lastNote") {
        const last = [...state.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        if (!last?.text) return "Aucune note";
        return last.text.length > 42 ? last.text.slice(0, 42) + "…" : last.text;
      }
      return null;
    }
    case "/library": {
      if (mode === "exerciseCount") {
        const n = library.exercises.length;
        return `${n} exercice${n > 1 ? "s" : ""} disponible${n > 1 ? "s" : ""}`;
      }
      if (mode === "favoriteExercise") {
        const favId = state.preferences?.favoriteExerciseId;
        if (!favId) return "⭐ Aucun favori défini";
        const fav = library.exercises.find((e) => e.id === favId);
        return fav ? `⭐ ${fav.name}` : "⭐ Favori introuvable";
      }
      return null;
    }
    default:
      return null;
  }
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Placeholder bannière Vue d'ensemble */}
      <div className="mb-3.5 h-[72px] rounded-2xl bg-surface2" />
      {/* Grille 2×3 */}
      <div className="grid grid-cols-2 gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-surface2" />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { me, state, library, loading, role, clients } = useData();
  const today = new Date().toISOString().slice(0, 10);
  const isCoach = role === "coach" || role === "admin";
  const displayName = state.profile.name || me?.name || me?.email || "Moi";

  // Pour les clients : messages non lus dans leur propre state
  const clientUnread = (state.messages ?? []).filter(m => !m.isRead && m.senderId !== me?.id).length;

  // Pour le coach/admin : agréger les messages non lus de TOUS les clients
  const [coachUnread, setCoachUnread] = useState(0);
  const [coachUrgent, setCoachUrgent] = useState(0);
  useEffect(() => {
    if (!isCoach || loading || !me) return;
    const clientIds = clients.filter(c => c.role === "client").map(c => c.id);
    if (clientIds.length === 0) return;
    const supabase = createClient();
    supabase
      .from("app_state")
      .select("data")
      .in("user_id", clientIds)
      .then(({ data: rows }) => {
        if (!rows) return;
        let unread = 0;
        let urgent = 0;
        for (const row of rows) {
          const msgs = ((row.data as { messages?: ChatMessage[] })?.messages ?? []);
          const fromOthers = msgs.filter(m => !m.isRead && m.senderId !== me.id);
          unread += fromOthers.length;
          urgent += fromOthers.filter(m => m.isUrgent).length;
        }
        setCoachUnread(unread);
        setCoachUrgent(urgent);
      });
  }, [isCoach, loading, clients, me]); // eslint-disable-line

  const unreadMessages = isCoach ? coachUnread : clientUnread;

  if (loading) return <DashboardSkeleton />;
  const cardColors = state.preferences?.cardColors ?? {};
  const cardColorMode = state.preferences?.cardColorMode ?? "full";

  // Prochain objectif à venir (le plus proche dans le futur).
  const nextGoal = state.goals
    .filter((g) => g.date && (daysUntil(g.date) ?? -1) >= 0)
    .sort((a, b) => (daysUntil(a.date)! - daysUntil(b.date)!))[0];

  return (
    <div>
      {/* Carte Vue d'ensemble (coach uniquement) */}
      {isCoach && (
        <Link
          href="/overview"
          className={`relative mb-3.5 flex items-center gap-3 overflow-hidden rounded-2xl border p-4 transition active:scale-95 ${
            coachUrgent > 0
              ? "border-danger/50 bg-danger/5"
              : "border-line bg-surface"
          }`}
        >
          <span className="absolute inset-0 opacity-10" style={{ background: coachUrgent > 0 ? "#ef4444" : "#a855f7" }} />
          <div className="relative shrink-0">
            <span className="text-3xl">{coachUrgent > 0 ? "🚨" : "👁️"}</span>
            {coachUrgent > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                {coachUrgent > 9 ? "9+" : coachUrgent}
              </span>
            )}
          </div>
          <div>
            <p className={`font-semibold ${coachUrgent > 0 ? "text-danger" : ""}`}>Vue d&apos;ensemble</p>
            <p className="text-[12px] text-dim">
              {coachUrgent > 0
                ? `${coachUrgent} message${coachUrgent > 1 ? "s" : ""} urgent${coachUrgent > 1 ? "s" : ""} non lu${coachUrgent > 1 ? "s" : ""}`
                : "Blessures & objectifs de tous les sportifs"}
            </p>
          </div>
          <span className="ml-auto text-dim">›</span>
        </Link>
      )}

      {/* Grille de cartes */}
      <div className="grid grid-cols-2 gap-3.5">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-4 transition active:scale-95"
          >
            {cardColorMode === "full" ? (
              <span className="absolute inset-0 opacity-20" style={{ background: cardColors[c.href] || c.color }} />
            ) : (
              <span className="absolute -right-7 -top-7 h-[90px] w-[90px] rounded-full opacity-15" style={{ background: cardColors[c.href] || c.color }} />
            )}
           <div className="flex items-start justify-between">
                 {c.href === "/profile" && state.profile.photo ? (
  <img src={state.profile.photo} alt="avatar" className="h-10 w-10 shrink-0 rounded-full object-cover border border-line" />
) : (
  <span className="text-3xl">{c.icon}</span>
)}
{/* Badge messages non lus sur Mon Suivi */}
{c.href === "/followup" && unreadMessages > 0 && (
  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
    {unreadMessages > 9 ? "9+" : unreadMessages}
  </span>
)}
  
{/* Le badge avec J-X, Nom et Lieu de la compétition au centre */}
  {c.href === "/goals" && nextGoal && (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
      {/* 1. Le J-X */}
      <span className="text-2xl font-black text-ok">
        {countdownLabel(nextGoal.date)}
      </span>
      
      {/* 2. Le nom exact de la compétition */}
      <span className="mt-1 text-xs font-bold truncate w-full px-1">
        {nextGoal.competition}
      </span>
      
      {/* 3. Le lieu exact */}
      {nextGoal.place && (
        <span className="mt-0.5 text-[11px] text-dim truncate w-full px-1">
          📍 {nextGoal.place}
        </span>
      )}
    </div>
  )}
</div>
            
            {/* Label + info dynamique */}
            <div className="mt-2">
              <div className="font-semibold text-lg truncate w-full">
                {c.href === "/profile" ? displayName : c.label}
              </div>
              {c.href !== "/profile" && c.href !== "/goals" && (() => {
                const info = getCardInfo(c.href, state, library, today);
                return info ? (
                  <p className="mt-0.5 text-[11px] text-dim leading-tight line-clamp-2">{info}</p>
                ) : null;
              })()}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
