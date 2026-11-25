"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "@/components/DataProvider";

type CoachNote = { id: string; body: string; author_id: string | null; author_name: string | null; created_at: string };

const fmtStamp = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
};

function NoteIcon({ size = 24 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

/**
 * Bulle « Notes privées » de la programmation (coach/admin sur le profil d'un sportif) :
 * notes datées, jamais visibles par le sportif, conservées jusqu'à suppression manuelle.
 * Rendue dans un portail : le conteneur du pull-to-refresh est transformé (casserait le `fixed`).
 */
export default function CoachNotesBubble() {
  const { role, me, activeUserId, clients } = useData();
  const isElevated = role === "coach" || role === "admin";
  const clientId = isElevated && activeUserId && activeUserId !== me?.id ? activeUserId : null;
  const client = clients.find((c) => c.id === clientId);
  const name = client?.name || client?.email || "ce sportif";
  const firstName = name.split(/\s+/)[0];

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<CoachNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/coach/notes?clientId=${encodeURIComponent(id)}`);
      const d = await res.json().catch(() => ({}));
      if (res.ok) setNotes(d.notes ?? []);
      else { setNotes([]); setError(d.error ?? "Notes indisponibles."); }
    } catch {
      setNotes([]);
      setError("Pas de connexion. Réessaie.");
    }
  }, []);

  // Changement de sportif : on repart de zéro (jamais les notes d'un autre à l'écran).
  useEffect(() => {
    setNotes(null);
    setDraft("");
    setConfirmId(null);
    setOpen(false);
    if (clientId) load(clientId);
  }, [clientId, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function add() {
    const text = draft.trim();
    if (!text || !clientId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, text }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.note) {
        setNotes((prev) => [d.note as CoachNote, ...(prev ?? [])]);
        setDraft("");
      } else setError(d.error ?? "La note n'a pas pu être enregistrée.");
    } catch {
      setError("Pas de connexion. Réessaie.");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    setConfirmId(null);
    const before = notes;
    setNotes((prev) => (prev ?? []).filter((n) => n.id !== id)); // optimiste
    const res = await fetch(`/api/coach/notes?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setNotes(before);
      setError("Suppression impossible. Réessaie.");
    }
  }

  if (!mounted || !clientId) return null;
  const count = notes?.length ?? 0;

  return createPortal(
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Notes privées sur ${name}${count ? ` (${count})` : ""}`}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 grid h-14 w-14 place-items-center rounded-full border border-accent/50 bg-surface text-accent shadow-[0_10px_28px_-8px_rgba(0,0,0,0.6)] transition active:scale-95"
      >
        <NoteIcon />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] px-1.5 text-xs font-black text-[#1a1500]">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-notes-title"
            className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border"
          >
            <div className="flex shrink-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="coach-notes-title" className="flex items-center gap-2 text-lg font-black">
                  <span className="text-accent"><NoteIcon size={20} /></span>
                  Notes sur {firstName}
                </h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-dim">
                  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                  Privées : {firstName} ne les voit pas.
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface2 text-dim">
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div className="mt-4 shrink-0 space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add(); }}
                rows={3}
                maxLength={2000}
                aria-label="Nouvelle note"
                placeholder="Ex. : remplacer les fentes, douleur au genou gauche"
                className="w-full resize-none"
              />
              <button
                onClick={add}
                disabled={!draft.trim() || saving}
                className="w-full rounded-xl bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] py-2.5 text-sm font-black text-[#1a1500] disabled:opacity-40"
              >
                {saving ? "Enregistrement…" : "Ajouter la note"}
              </button>
              {error && <p role="alert" className="text-xs font-semibold text-danger">{error}</p>}
            </div>

            <div className="-mx-1 mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto px-1 pb-1">
              {notes === null && <p className="py-6 text-center text-sm text-dim">Chargement…</p>}
              {notes?.length === 0 && !error && (
                <p className="py-6 text-center text-sm text-dim">
                  Aucune note pour l&apos;instant. Garde ici ce qu&apos;il faut avoir en tête pour sa programmation.
                </p>
              )}
              {notes?.map((n) => (
                <article key={n.id} className="rounded-2xl border border-line bg-surface2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs">
                      <time dateTime={n.created_at} className="font-black text-accent">{fmtStamp(n.created_at)}</time>
                      {n.author_name && n.author_id !== me?.id && <span className="text-dim"> · {n.author_name}</span>}
                    </p>
                    {confirmId === n.id ? (
                      <span className="flex shrink-0 gap-1.5">
                        <button onClick={() => setConfirmId(null)} className="rounded-lg bg-surface px-2.5 py-1 text-xs font-bold">Garder</button>
                        <button onClick={() => remove(n.id)} className="rounded-lg bg-danger px-2.5 py-1 text-xs font-bold text-white">Supprimer</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmId(n.id)}
                        aria-label="Supprimer cette note"
                        className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-dim"
                      >
                        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-sm">{n.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
