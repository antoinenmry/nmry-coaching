"use client";

import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { AUTH_ENABLED } from "@/lib/config";
import { daysUntil, countdownLabel } from "@/lib/dates";

const CARDS = [
  { href: "/profile", icon: "👤", label: "Mon Profil", color: "var(--color-accent)" },
  { href: "/plan", icon: "🗓️", label: "Programmation", color: "var(--color-accent2)" },
  { href: "/goals", icon: "🎯", label: "Mes Objectifs", color: "var(--color-ok)" },
  { href: "/records", icon: "🏆", label: "Mes Records", color: "var(--color-accent)" },
  { href: "/followup", icon: "📝", label: "Mon Suivi", color: "var(--color-danger)" },
  { href: "/library", icon: "📚", label: "Ma Bibliothèque", color: "var(--color-accent)" },
];

export default function Dashboard() {
  const { me, state, clients, activeUserId, switchClient, signOut, loading, isGuest, role, setRole } = useData();
  const isCoach = me?.role === "coach";
  const displayName = state.profile.name || me?.name || me?.email || "Moi";

  // Prochain objectif à venir (le plus proche dans le futur).
  const nextGoal = state.goals
    .filter((g) => g.date && (daysUntil(g.date) ?? -1) >= 0)
    .sort((a, b) => (daysUntil(a.date)! - daysUntil(b.date)!))[0];

  return (
    <div>
      
     {/* Barre utilisateur épurée */}
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          {isGuest ? (

    
            <div className="flex rounded-lg bg-surface2 p-0.5">
              {(["coach", "client"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`rounded-md px-2.5 py-1 text-[13px] font-semibold capitalize ${
                    role === r ? "bg-accent text-[#1a1500]" : "text-dim"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          ) : (
            <span
              className={`rounded-full px-2 py-0.5 text-[14px] font-bold ${
                isCoach ? "bg-accent/20 text-accent" : "bg-accent2/20 text-[#90caf9]"
              }`}
            >
              {!AUTH_ENABLED ? "Mode local" : isCoach ? "Coach" : "Client"}
            </span>
          )}
        </div>
        {AUTH_ENABLED && (
          <button
            onClick={signOut}
            className="rounded-lg bg-surface2 px-3 py-1.5 text-[13px] font-semibold"
          >
            Déconnexion
          </button>
        )}
      </div>

      {/* Sélecteur de client (coach) */}
      {AUTH_ENABLED && isCoach && (
        <label className="mb-3 block rounded-xl border border-line bg-surface px-4 py-2.5">
          <span className="mb-1 block text-[11px] text-dim">Client affiché</span>
          <select
            value={activeUserId ?? ""}
            onChange={(e) => switchClient(e.target.value)}
            disabled={loading}
          >
            {clients.length === 0 && <option>Aucun compte</option>}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {(c.name || c.email) + (c.role === "coach" ? " (moi)" : "")}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* 4 carrés */}
      <div className="grid grid-cols-2 gap-3.5">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border border-line bg-surface p-4 transition active:scale-95"
          >
            <span
              className="absolute -right-7 -top-7 h-[90px] w-[90px] rounded-full opacity-15"
              style={{ background: c.color }}
            />
           <div className="flex items-start justify-between">
                 {c.href === "/profile" && state.profile.photo ? (
  <img src={state.profile.photo} alt="avatar" className="h-10 w-10 shrink-0 rounded-full object-cover border border-line" />
) : (
  <span className="text-3xl">{c.icon}</span>
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
