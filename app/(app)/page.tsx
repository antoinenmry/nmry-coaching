"use client";

import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { AUTH_ENABLED } from "@/lib/config";
import { daysUntil, countdownLabel } from "@/lib/dates";

const CARDS = [
  { href: "/profile", icon: "👤", label: "Profil" },
  { href: "/plan", icon: "🗓️", label: "Programmation", sub: "Vue mois / semaine, glisser-déposer", color: "var(--color-accent2)" },
  { href: "/goals", icon: "🎯", label: "Objectifs", sub: "Compétitions & performances visées", color: "var(--color-ok)" },
  { href: "/followup", icon: "📝", label: "Suivi perso", sub: "Commentaires, blessures, ressenti", color: "var(--color-danger)" },
  { href: "/library", icon: "📚", label: "Bibliothèque", sub: "Exercices & filtres personnalisables", color: "var(--color-accent)" },
];

export default function Dashboard() {
  const { me, state, clients, activeUserId, switchClient, signOut, loading } = useData();
  const isCoach = me?.role === "coach";
  const displayName = state.profile.name || me?.name || me?.email || "Moi";

  // Prochain objectif à venir (le plus proche dans le futur).
  const nextGoal = state.goals
    .filter((g) => g.date && (daysUntil(g.date) ?? -1) >= 0)
    .sort((a, b) => (daysUntil(a.date)! - daysUntil(b.date)!))[0];

  return (
    <div>
      {/* Barre utilisateur */}
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <strong>{displayName}</strong>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              isCoach ? "bg-accent/20 text-accent" : "bg-accent2/20 text-[#90caf9]"
            }`}
          >
            {!AUTH_ENABLED ? "Mode local" : isCoach ? "Coach" : "Client"}
          </span>
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
              <span className="text-3xl">{c.icon}</span>
              {c.href === "/goals" && nextGoal && (
                <span className="rounded-full bg-ok/20 px-2 py-0.5 text-[11px] font-bold text-ok">
                  {countdownLabel(nextGoal.date)}
                </span>
              )}
            </div>
            <div>
              <div className="text-base font-bold leading-tight">{c.label}</div>
              <div className="text-xs text-dim">
                {c.href === "/goals" && nextGoal ? `Prochain : ${nextGoal.competition}` : c.sub}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
