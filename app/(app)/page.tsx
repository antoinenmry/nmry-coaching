"use client";

import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { AUTH_ENABLED } from "@/lib/config";
import { daysUntil, countdownLabel } from "@/lib/dates";

const CARDS = [
  { href: "/profile", icon: "👤", label: "Profil" },
  { href: "/plan", icon: "🗓️", label: "Programmation", color: "var(--color-accent2)" },
  { href: "/goals", icon: "🎯", label: "Objectifs", color: "var(--color-ok)" },
  { href: "/records", icon: "🏆", label: "Records", color: "var(--color-accent)" },
  { href: "/followup", icon: "📝", label: "Suivi perso", color: "var(--color-danger)" },
  { href: "/library", icon: "📚", label: "Bibliothèque", color: "var(--color-accent)" },
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
      {/* Barre utilisateur */}
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          {state.profile.photo ? (
            <img src={state.profile.photo} alt="avatar" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface2 text-base">👤</span>
          )}
          <strong>{displayName}</strong>
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
                  <span className="text-3xl">{c.icon}</span>
  
  {/* Le badge "J-X" centré et gros au milieu de la case */}
  {c.href === "/goals" && nextGoal && (
    <div className="absolute inset-0 flex items-center justify-center text-3xl font-black text-ok">
      {countdownLabel(nextGoal.date)}
    </div>
  )}
</div>
            {/* On ferme la div correctement et on ajoute le label */}
          <div className="mt-2 font-semibold text-lg">
  {c.label}
</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
