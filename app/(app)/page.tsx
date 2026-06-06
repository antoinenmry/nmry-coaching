"use client";

import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { daysUntil, countdownLabel } from "@/lib/dates";

const CARDS = [
  { href: "/profile", icon: "👤", label: "Mon Profil", color: "var(--color-accent)" },
  { href: "/plan", icon: "🗓️", label: "Programmation", color: "var(--color-accent2)" },
  { href: "/goals", icon: "🎯", label: "Mes Objectifs", color: "var(--color-ok)" },
  { href: "/records", icon: "🏆", label: "Mes Records", color: "var(--color-accent)" },
  { href: "/followup", icon: "📝", label: "Mon Suivi", color: "var(--color-danger)" },
  { href: "/library", icon: "📚", label: "Ma Bibliothèque", color: "var(--color-accent)" },
];

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
  const { me, state, loading, role } = useData();
  const isCoach = role === "coach" || role === "admin";
  const displayName = state.profile.name || me?.name || me?.email || "Moi";
  const unreadMessages = (state.messages ?? []).filter(m => !m.isRead && m.senderId !== me?.id).length;

  if (loading) return <DashboardSkeleton />;
  const cardColors = state.preferences?.cardColors ?? {};
  const cardColorMode = state.preferences?.cardColorMode ?? "arc";

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
          className="relative mb-3.5 flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-4 transition active:scale-95"
        >
          <span className="absolute inset-0 opacity-10" style={{ background: "#a855f7" }} />
          <span className="text-3xl">👁️</span>
          <div>
            <p className="font-semibold">Vue d&apos;ensemble</p>
            <p className="text-[12px] text-dim">Blessures & objectifs de tous les sportifs</p>
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
            
            {/* On affiche le nom de l'utilisateur à la place de "Mon Profil" */}
          <div className="mt-2 font-semibold text-lg truncate w-full">
  {c.href === "/profile" ? displayName : c.label}
</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
