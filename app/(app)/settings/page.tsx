"use client";

import { useCallback, useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";
import { useTheme } from "@/components/ThemeProvider";
import type { AthleteAdminData, AthleteStatus, AdminOverview, CoachWithClients, Profile } from "@/lib/types";

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
  const { role } = useData();
  const [athletes, setAthletes] = useState<AthleteAdminData[]>([]);
  const [unassigned, setUnassigned] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const fetchAthletes = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [res, resU] = await Promise.all([
        fetch("/api/coach/athletes"),
        role === "coach" ? fetch("/api/coach/unassigned") : Promise.resolve(null),
      ]);
      if (!res.ok) throw new Error(await res.text());
      setAthletes(await res.json());
      if (resU && resU.ok) setUnassigned(await resU.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [role]);

  async function selfAssign(clientId: string) {
    setPendingAction(clientId + "-assign");
    await fetch("/api/coach/self-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    await fetchAthletes();
    setPendingAction(null);
  }

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

  return (
    <>
      {athletes.length === 0 && unassigned.length === 0 && (
        <p className="py-6 text-center text-sm text-dim">Aucun sportif enregistré.</p>
      )}
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

      {/* Sportifs sans coach (coach uniquement) */}
      {role === "coach" && unassigned.length > 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-line p-4">
          <p className="mb-3 text-sm font-semibold text-dim">
            Sportifs sans coach ({unassigned.length})
          </p>
          <div className="space-y-2">
            {unassigned.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name || "—"}</p>
                  <p className="truncate text-[12px] text-dim">{c.email}</p>
                </div>
                <button
                  onClick={() => selfAssign(c.id)}
                  disabled={!!pendingAction}
                  className="shrink-0 rounded-lg bg-accent/15 px-3 py-1.5 text-[12px] font-semibold text-accent hover:bg-accent/25 disabled:opacity-50"
                >
                  {pendingAction === c.id + "-assign" ? "…" : "M'affecter"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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

// ─── Panneau Administration (admin uniquement) ────────────────────────────────
function AdminManager() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/overview");
      if (!res.ok) throw new Error(await res.text());
      setOverview(await res.json());
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeRole(userId: string, newRole: "client" | "coach") {
    setPending(userId + "-role");
    await fetch(`/api/coach/athletes/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    await load();
    setPending(null);
  }

  async function unassign(clientId: string) {
    setPending(clientId + "-unassign");
    await fetch(`/api/admin/assignments/${clientId}`, { method: "DELETE" });
    await load();
    setPending(null);
  }

  async function assign(clientId: string, coachId: string) {
    setPending(clientId + "-assign");
    await fetch("/api/admin/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, coachId }),
    });
    await load();
    setPending(null);
  }

  if (loading) return <p className="py-6 text-center text-sm text-dim">Chargement…</p>;
  if (error) return <p className="py-6 text-center text-sm text-danger">Erreur : {error}</p>;
  if (!overview) return null;

  const coaches = overview.coaches;
  const allCoaches = coaches.filter((c) => c.role === "coach" || c.role === "admin");

  return (
    <div className="space-y-4">
      {/* Coaches et leurs clients */}
      {coaches.map((coach) => (
        <div key={coach.id} className="rounded-2xl border border-line bg-surface2 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{coach.name || "—"}</p>
              <p className="truncate text-xs text-dim">{coach.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${
                coach.role === "admin" ? "bg-[#a855f7]/20 text-[#a855f7]" : "bg-accent/20 text-accent"
              }`}>
                {coach.role === "admin" ? "Admin" : "Coach"}
              </span>
              {coach.role === "coach" && (
                <button
                  onClick={() => changeRole(coach.id, "client")}
                  disabled={!!pending}
                  className="rounded-lg bg-surface px-2.5 py-1 text-[12px] font-semibold text-dim hover:bg-danger/10 hover:text-danger"
                >
                  {pending === coach.id + "-role" ? "…" : "→ Client"}
                </button>
              )}
            </div>
          </div>

          {/* Clients affectés */}
          {coach.clients.length === 0 ? (
            <p className="text-sm text-dim">Aucun client affecté.</p>
          ) : (
            <div className="space-y-1.5">
              {coach.clients.map((client) => (
                <div key={client.id} className="flex items-center justify-between rounded-xl bg-surface px-3 py-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{client.name || client.email}</span>
                    {client.name && <span className="ml-2 text-xs text-dim">{client.email}</span>}
                  </div>
                  <button
                    onClick={() => unassign(client.id)}
                    disabled={!!pending}
                    className="shrink-0 text-[12px] text-dim hover:text-danger"
                  >
                    {pending === client.id + "-unassign" ? "…" : "✕"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Clients sans coach */}
      {overview.unassigned.length > 0 && (
        <div className="rounded-2xl border border-dashed border-line p-4">
          <p className="mb-3 text-sm font-semibold text-dim">
            Clients sans coach ({overview.unassigned.length})
          </p>
          <div className="space-y-2">
            {overview.unassigned.map((client) => (
              <div key={client.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2">
                <div className="min-w-0">
                  <span className="text-sm">{client.name || client.email}</span>
                  {client.name && <span className="ml-2 text-xs text-dim">{client.email}</span>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    defaultValue=""
                    onChange={(e) => e.target.value && assign(client.id, e.target.value)}
                    disabled={!!pending}
                    className="rounded-lg border border-line bg-surface2 px-2 py-1 text-[12px]"
                  >
                    <option value="" disabled>Affecter à…</option>
                    {allCoaches.map((c) => (
                      <option key={c.id} value={c.id}>{c.name || c.email}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => changeRole(client.id, "coach")}
                    disabled={!!pending}
                    className="rounded-lg bg-surface2 px-2.5 py-1 text-[12px] font-semibold text-dim hover:bg-accent/10 hover:text-accent"
                  >
                    {pending === client.id + "-role" ? "…" : "→ Coach"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Composer Broadcast ──────────────────────────────────────────────────────
function BroadcastComposer() {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!msg.trim()) return;
    setSending(true); setError(null); setSent(false);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg.trim(), expiresInHours: 24 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erreur inconnue");
      }
      setMsg("");
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-1 font-bold">📢 Broadcast</h2>
      <p className="mb-3 text-[12px] text-dim">
        Envoie un message pop-up à tous tes sportifs en temps réel. Visible 24 h.
      </p>
      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="Rappel séance, fermeture, annonce…"
        rows={3}
        className="w-full resize-none rounded-xl border border-line bg-surface2 p-3 text-sm outline-none focus:border-accent"
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      <button
        onClick={send}
        disabled={sending || !msg.trim()}
        className="mt-2 w-full rounded-xl bg-accent py-2.5 font-semibold text-[#1a1500] transition disabled:opacity-40"
      >
        {sending ? "Envoi…" : sent ? "✅ Envoyé !" : "Envoyer à tous les sportifs"}
      </button>
    </section>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { me, role, signOut, state, update } = useData();
  const { theme, toggleTheme, bgColor, setBgColor, resetBgColor } = useTheme();
  const cardColors = state.preferences?.cardColors ?? {};
  const cardColorMode = state.preferences?.cardColorMode ?? "arc";
  const [tab, setTab] = useState<"affichage" | "sportifs" | "admin">("affichage");

  const isElevated = role === "coach" || role === "admin";

  function setCardColor(href: string, color: string) {
    update((s) => {
      if (!s.preferences) s.preferences = { cardColors: {}, cardColorMode: "arc" };
      s.preferences.cardColors[href] = color;
    });
  }

  function resetColors() {
    update((s) => { s.preferences = { cardColors: {}, cardColorMode: s.preferences?.cardColorMode ?? "arc" }; });
  }

  // Définir les onglets selon le rôle
  const tabs = [
    { id: "affichage" as const, label: "☀️ Affichage" },
    ...(isElevated ? [{ id: "sportifs" as const, label: "👥 Sportifs" }] : []),
    ...(role === "admin" ? [{ id: "admin" as const, label: "🛡 Admin" }] : []),
  ];

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
            role === "admin"  ? "bg-[#a855f7]/20 text-[#a855f7]" :
            role === "coach"  ? "bg-accent/20 text-accent" :
                                "bg-accent2/20 text-accent2"
          }`}>
            {role === "admin" ? "Admin" : role === "coach" ? "Coach" : "Sportif"}
          </span>
        </div>
        <button
          onClick={signOut}
          className="mt-4 w-full rounded-xl bg-danger/15 py-2.5 font-semibold text-danger"
        >
          Déconnexion
        </button>
      </section>

      {/* Switch pleine largeur */}
      {tabs.length > 1 && (
        <div className="flex rounded-2xl bg-surface2 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                tab === t.id ? "bg-accent text-[#1a1500] shadow-sm" : "text-dim"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Onglet Affichage */}
      {tab === "affichage" && (
        <>
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
            {isElevated && (
              <>
                <hr className="my-3 border-line" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Couleur de fond</p>
                    <p className="text-[12px] text-dim">Différenciation visuelle coach / sportif</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-surface2 p-1"
                    />
                    <button
                      onClick={resetBgColor}
                      className="rounded-lg bg-surface2 px-3 py-1.5 text-[12px] text-dim hover:text-ink"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                {/* Presets de couleurs */}
                <div className="mt-2.5 flex gap-2">
                  {(theme === "dark"
                    ? ["#0f1115", "#0a0f1a", "#10091a", "#091510", "#150909", "#0f120a"]
                    : ["#f4f5f7", "#e8f0fe", "#f3e8ff", "#e8f5e9", "#fce8e6", "#fffde7"]
                  ).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setBgColor(preset)}
                      title={preset}
                      className="h-7 w-7 shrink-0 rounded-full border-2 transition"
                      style={{
                        background: preset,
                        borderColor: bgColor === preset ? "var(--color-accent)" : "var(--color-line)",
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

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

      {/* Onglet Sportifs */}
      {tab === "sportifs" && isElevated && (
        <>
          <BroadcastComposer />
          <section className="rounded-2xl border border-line bg-surface p-4">
            <AthletesManager />
          </section>
        </>
      )}

      {/* Onglet Admin */}
      {tab === "admin" && role === "admin" && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <AdminManager />
        </section>
      )}

    </div>
  );
}
