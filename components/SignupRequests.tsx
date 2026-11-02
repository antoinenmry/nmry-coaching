"use client";

import { useCallback, useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";
import { DEFAULT_COACH_EMAIL } from "@/lib/config";
import type { Profile } from "@/lib/types";

/** Émis après chaque acceptation/refus : tous les affichages des demandes se remettent à jour. */
export const SIGNUP_REQUESTS_CHANGED = "nmry:signup-requests-changed";

/**
 * Demandes d'inscription en attente (sportifs sans coach).
 * Réservé aux coachs et au coach par défaut, même s'il a le rôle admin :
 * accepter une demande affecte le sportif à la personne qui accepte.
 */
export function useSignupRequests() {
  const { role, me, addClient } = useData();
  const enabled = role === "coach" || (role === "admin" && me?.email?.toLowerCase() === DEFAULT_COACH_EMAIL);
  const [requests, setRequests] = useState<Profile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) { setRequests([]); return; }
    try {
      const res = await fetch("/api/coach/unassigned", { cache: "no-store" });
      if (res.ok) setRequests(await res.json());
    } catch {
      // hors ligne : on garde la dernière liste connue
    }
  }, [enabled]);

  useEffect(() => {
    load();
    // PWA restée en arrière-plan : on revérifie à son retour au premier plan.
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener(SIGNUP_REQUESTS_CHANGED, load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(SIGNUP_REQUESTS_CHANGED, load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  async function run(id: string, action: () => Promise<Response>, fallback: string, onOk?: () => void) {
    setBusy(id);
    setError(null);
    try {
      const res = await action();
      if (res.ok) onOk?.();
      else setError((await res.json().catch(() => ({}))).error ?? fallback);
    } catch {
      setError(fallback);
    }
    window.dispatchEvent(new Event(SIGNUP_REQUESTS_CHANGED));
    setBusy(null);
  }

  function accept(c: Profile) {
    return run(
      c.id,
      () => fetch("/api/coach/self-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: c.id }),
      }),
      "La demande n'a pas pu être acceptée. Réessaie.",
      () => addClient(c),
    );
  }

  function refuse(c: Profile) {
    if (!window.confirm(`Refuser l'inscription de ${c.name || c.email} ? Son compte sera supprimé.`)) return;
    return run(
      c.id,
      () => fetch(`/api/coach/athletes/${c.id}`, { method: "DELETE" }),
      "La demande n'a pas pu être refusée. Réessaie.",
    );
  }

  return { enabled, requests, busy, error, accept, refuse };
}

export type SignupRequestsState = ReturnType<typeof useSignupRequests>;

/** Liste des demandes avec les actions Refuser / Accepter. */
export function SignupRequestList({ sr, rowClassName = "bg-surface" }: { sr: SignupRequestsState; rowClassName?: string }) {
  return (
    <>
      {sr.error && <p role="alert" className="mb-2 text-[12.5px] font-semibold text-danger">{sr.error}</p>}
      <div className="space-y-2">
        {sr.requests.map((c) => (
          <div key={c.id} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 ${rowClassName}`}>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-black">{c.name || "Sans nom"}</p>
              <p className="truncate text-[12px] text-dim">{c.email}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => sr.refuse(c)}
                disabled={!!sr.busy}
                className="rounded-full bg-danger/10 px-3 py-2 text-[12px] font-bold text-danger hover:bg-danger/20 disabled:opacity-50"
              >
                Refuser
              </button>
              <button
                onClick={() => sr.accept(c)}
                disabled={!!sr.busy}
                className="rounded-full bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] px-3.5 py-2 text-[12px] font-black text-[#1a1500] transition active:scale-95 disabled:opacity-50"
              >
                {sr.busy === c.id ? "…" : "Accepter"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function requestsIntro(count: number) {
  return count > 1
    ? "Ces personnes n'ont accès à rien tant que tu ne les as pas acceptées."
    : "Cette personne n'a accès à rien tant que tu ne l'as pas acceptée.";
}

/** Bloc de la vue d'ensemble : reste affiché et mis en avant tant qu'une demande est en attente. */
export function SignupRequestsCard() {
  const sr = useSignupRequests();
  const count = sr.requests.length;
  if (count === 0) return null;
  return (
    <section className="nmry-gold-ring mb-4 rounded-2xl bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-accent)_20%,var(--color-surface)),var(--color-surface)_70%)] p-4">
      <h2 className="text-[11px] font-black uppercase tracking-[0.12em] text-accent">
        {count} demande{count > 1 ? "s" : ""} d&apos;inscription
      </h2>
      <p className="mb-3 mt-1 text-[12.5px] text-dim">{requestsIntro(count)}</p>
      <SignupRequestList sr={sr} />
    </section>
  );
}

const seenKey = (userId: string) => `nmry_seen_signup_requests:${userId}`;

function getSeenIds(userId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(seenKey(userId)) ?? "[]"));
  } catch {
    return new Set();
  }
}

function markSeen(userId: string, ids: string[]) {
  try {
    const all = [...getSeenIds(userId), ...ids];
    localStorage.setItem(seenKey(userId), JSON.stringify([...new Set(all)].slice(-200)));
  } catch {
    // silently fail
  }
}

/** Pop-up unique par demande : à la première ouverture de l'app qui suit la demande. */
export function SignupRequestsPopup() {
  const { me } = useData();
  const sr = useSignupRequests();
  const { requests } = sr;
  const [open, setOpen] = useState(false);
  const count = requests.length;
  const userId = me?.id;

  useEffect(() => {
    if (!userId) return;
    if (requests.length === 0) { setOpen(false); return; }
    const seen = getSeenIds(userId);
    if (requests.some((r) => !seen.has(r.id))) {
      markSeen(userId, requests.map((r) => r.id));
      setOpen(true);
    }
  }, [userId, requests]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || count === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-5"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-requests-title"
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl border border-accent/60 bg-surface p-5 shadow-2xl"
      >
        <h2 id="signup-requests-title" className="text-lg font-black">
          {count > 1 ? `${count} demandes d'inscription` : "Nouvelle demande d'inscription"}
        </h2>
        <p className="mb-3 mt-1 text-[13px] text-dim">{requestsIntro(count)}</p>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SignupRequestList sr={sr} rowClassName="bg-surface2" />
        </div>
        <button
          autoFocus
          onClick={() => setOpen(false)}
          className="mt-4 w-full shrink-0 rounded-full bg-surface2 py-3 text-sm font-bold"
        >
          Plus tard
        </button>
        <p className="mt-2 shrink-0 text-center text-[12px] text-dim">
          {count > 1 ? "Ces demandes restent" : "Cette demande reste"} dans ta vue d&apos;ensemble.
        </p>
      </div>
    </div>
  );
}
