"use client";

import { useData } from "@/components/DataProvider";
import { useTheme } from "@/components/ThemeProvider";

const CARDS = [
  { href: "/profile",  icon: "👤", label: "Mon Profil",      defaultColor: "#ffb300" },
  { href: "/plan",     icon: "🗓️", label: "Programmation",   defaultColor: "#42a5f5" },
  { href: "/goals",    icon: "🎯", label: "Objectifs",        defaultColor: "#66bb6a" },
  { href: "/records",  icon: "🏆", label: "Records",          defaultColor: "#ffb300" },
  { href: "/followup", icon: "📝", label: "Suivi",            defaultColor: "#ef5350" },
  { href: "/library",  icon: "📚", label: "Bibliothèque",     defaultColor: "#ffb300" },
];

export default function SettingsPage() {
  const { me, role, signOut, state, update } = useData();
  const { theme, toggleTheme } = useTheme();
  const cardColors = state.preferences?.cardColors ?? {};
  const cardColorMode = state.preferences?.cardColorMode ?? "arc";

  function setCardColor(href: string, color: string) {
    update((s) => {
      if (!s.preferences) s.preferences = { cardColors: {}, cardColorMode: "arc" };
      s.preferences.cardColors[href] = color;
    });
  }

  function resetColors() {
    update((s) => { s.preferences = { cardColors: {}, cardColorMode: s.preferences?.cardColorMode ?? "arc" }; });
  }

  return (
    <div className="space-y-4">

      {/* Compte */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-bold">Compte</h2>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{me?.name || me?.email}</p>
            <p className="truncate text-sm text-dim">{me?.email}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-bold ${
            role === "coach" ? "bg-accent/20 text-accent" : "bg-accent2/20 text-accent2"
          }`}>
            {role === "coach" ? "Coach" : "Sportif"}
          </span>
        </div>
        <button
          onClick={signOut}
          className="mt-4 w-full rounded-xl bg-danger/15 py-2.5 font-semibold text-danger"
        >
          Déconnexion
        </button>
      </section>

      {/* Apparence */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-bold">Apparence</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm">Mode d&apos;affichage</span>
          <button
            onClick={toggleTheme}
            className="rounded-xl border border-line bg-surface2 px-4 py-2 text-sm font-semibold"
          >
            {theme === "dark" ? "🌙 Sombre" : "☀️ Clair"}
          </button>
        </div>
      </section>

      {/* Couleurs des cartes */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-bold">Couleurs des cartes</h2>

        {/* Toggle arc / fond complet */}
        <div className="mb-4 flex rounded-xl bg-surface2 p-1">
          {(["arc", "full"] as const).map((m) => (
            <button
              key={m}
              onClick={() => update((s) => { s.preferences.cardColorMode = m; })}
              className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition ${
                cardColorMode === m ? "bg-accent text-[#1a1500]" : "text-dim"
              }`}
            >
              {m === "arc" ? "Arc de cercle" : "Fond complet"}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {CARDS.map((card) => (
            <div key={card.href} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-5 w-5 shrink-0 rounded-full"
                  style={{ background: cardColors[card.href] || card.defaultColor }}
                />
                <span className="text-sm">{card.icon} {card.label}</span>
              </div>
              <input
                type="color"
                value={cardColors[card.href] || card.defaultColor}
                onChange={(e) => setCardColor(card.href, e.target.value)}
              />
            </div>
          ))}
        </div>
        <button
          onClick={resetColors}
          className="mt-4 text-xs text-dim underline"
        >
          Réinitialiser les couleurs
        </button>
      </section>

    </div>
  );
}
