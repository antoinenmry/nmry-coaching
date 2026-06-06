"use client";

import { useCallback, useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";
import { useTheme } from "@/components/ThemeProvider";
import type { AthleteAdminData, AthleteStatus } from "@/lib/types";

const CARDS = [
  { href: "/profile",  icon: "👤", label: "Mon Profil",      defaultColor: "#ffb300" },
  { href: "/plan",     icon: "🗓️", label: "Programmation",   defaultColor: "#42a5f5" },
  { href: "/goals",    icon: "🎯", label: "Objectifs",        defaultColor: "#66bb6a" },
  { href: "/records",  icon: "🏆", label: "Records",          defaultColor: "#ffb300" },
  { href: "/followup", icon: "📝", label: "Suivi",            defaultColor: "#ef5350" },
  { href: "/library",  icon: "📚", label: "Bibliothèque",     defaultColor: "#ffb300" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  // Supabase peut retourner des timestamps sans indicateur de timezone → forcer UTC
  const normalized = /[Z+]/.test(iso.slice(10)) ? iso : iso.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH} h`;
  if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? "s" : ""}`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
}

// ─── Vue Gestion des Profils ─────────────────────────────────────────────────
function AthletesManager() {
  const [athletes, setAthletes] = useState<AthleteAdminData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null); // modale confirm
  const [pendingAction, setPendingAction] = useState<string | null>(null); // spinner

  const fetchAthletes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/athletes");
      if (!res.ok) throw new Error(await res.text());
      setAthletes(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAthletes(); }, [fetchAthletes]);

  async function toggleStatus(id: string, current: AthleteStatus) {
    setPendingAction(id + "-status");
    const next: AthleteStatus = current === "active" ? "inactive" : "active";
    await fetch(`/api/coach/athletes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setAthletes((prev) => prev.map((a) => a.id === id ? { ...a, status: next } : a));
    setPendingAction(null);
  }

  async function deleteAthlete(id: string) {
    setPendingAction(id + "-delete");
    const res = await fetch(`/api/coach/athletes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAthletes((prev) => prev.filter((a) => a.id !== id));
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Erreur lors de la suppression");
    }
    setDeletingId(null);
    setPendingAction(null);
  }

  if (loading) return <p className="py-6 text-center text-sm text-dim">Chargement des sportifs…</p>;
  if (error)   return <p className="py-6 text-center text-sm text-danger">Erreur : {error}</p>;
  if (athletes.length === 0) return <p className="py-6 text-center text-sm text-dim">Aucun sportif enregistré.</p>;

  return (
    <>
      <div className="space-y-3">
        {athletes.map((a) => {
          const isActive = a.status === "active";
          return (
            <div
              key={a.id}
              className={`rounded-2xl border p-4 ${isActive ? "border-line bg-surface" : "border-line bg-surface2 opacity-70"}`}
            >
              {/* En-tête : nom + badge statut */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.name || "—"}</p>
                  <p className="truncate text-[12px] text-dim">{a.email}</p>
                </div>
                <button
                  onClick={() => toggleStatus(a.id, a.status)}
                  disabled={pendingAction === a.id + "-status"}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold transition ${
                    isActive
                      ? "bg-ok/20 text-ok hover:bg-ok/30"
                      : "bg-surface text-dim hover:bg-surface2"
                  }`}
                >
                  {pendingAction === a.id + "-status" ? "…" : isActive ? "Actif" : "Inactif"}
                </button>
              </div>

              {/* Métadonnées */}
              <div className="grid grid-cols-1 gap-1.5 rounded-xl bg-surface2 px-3 py-2.5 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold text-dim">Dernière connexion</p>
                  <p className="text-[12px]">{fmtDate(a.last_sign_in_at)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-dim">Modif. par le sportif</p>
                  <p className="text-[12px]">{fmtDate(a.updated_by_client_at)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-dim">Modif. par le coach</p>
                  <p className="text-[12px]">{fmtDate(a.updated_by_coach_at)}</p>
                </div>
              </div>

              {/* Action suppression */}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => setDeletingId(a.id)}
                  className="rounded-lg bg-danger/10 px-3 py-1.5 text-[12px] font-semibold text-danger hover:bg-danger/20"
                >
                  Supprimer le sportif
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modale confirmation suppression */}
      {deletingId && (() => {
        const target = athletes.find((a) => a.id === deletingId);
        return (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
            onClick={(e) => e.target === e.currentTarget && setDeletingId(null)}
          >
            <div className="w-full max-w-sm rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
              <h2 className="mb-2 text-lg font-bold text-danger">⚠️ Supprimer le sportif ?</h2>
              <p className="mb-1 text-sm">
                <span className="font-semibold">{target?.name || target?.email}</span>
              </p>
              <p className="mb-5 text-sm text-dim">
                Cette action est <strong>irréversible</strong> : le compte, les données de planning,
                objectifs, suivi et records seront définitivement supprimés.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 rounded-xl border border-line py-3 text-sm font-semibold"
                >
                  Annuler
                </button>
                <button
                  onClick={() => deleteAthlete(deletingId)}
                  disabled={!!pendingAction}
                  className="flex-1 rounded-xl bg-danger py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pendingAction ? "Suppression…" : "Confirmer"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { me, role, signOut, state, update } = useData();
  const { theme, toggleTheme } = useTheme();
  const cardColors = state.preferences?.cardColors ?? {};
  const cardColorMode = state.preferences?.cardColorMode ?? "arc";
  const [tab, setTab] = useState<"affichage" | "sportifs">("affichage");

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

      {/* Compte — toujours visible */}
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

      {/* Switch pleine largeur — coach uniquement */}
      {role === "coach" && (
        <div className="flex rounded-2xl bg-surface2 p-1">
          {(["affichage", "sportifs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                tab === t ? "bg-accent text-[#1a1500] shadow-sm" : "text-dim"
              }`}
            >
              {t === "affichage" ? "☀️ Affichage" : "👥 Sportifs"}
            </button>
          ))}
        </div>
      )}

      {/* Contenu onglet Affichage (ou toujours visible si athlete) */}
      {(role !== "coach" || tab === "affichage") && (
        <>
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
            <button onClick={resetColors} className="mt-4 text-xs text-dim underline">
              Réinitialiser les couleurs
            </button>
          </section>
        </>
      )}

      {/* Contenu onglet Sportifs */}
      {role === "coach" && tab === "sportifs" && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <AthletesManager />
        </section>
      )}

    </div>
  );
}
