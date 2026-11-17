"use client";

import { useState } from "react";
import Link from "next/link";
import { useData } from "@/components/DataProvider";

/** Droits RGPD dans Réglages → Compte : télécharger ses données, supprimer son compte (sportif). */
export default function MyDataSection() {
  const { me } = useData();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isClient = me?.role === "client";

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: typed.trim().toUpperCase() }),
      });
      if (res.ok) { window.location.href = "/login"; return; }
      setError((await res.json().catch(() => ({}))).error ?? "La suppression a échoué.");
    } catch {
      setError("Pas de connexion. Réessaie.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-4 space-y-2 border-t border-line pt-4">
      <p className="text-sm font-bold">Mes données</p>
      <a
        href="/api/me/export"
        download
        className="block w-full rounded-xl bg-surface2 py-2.5 text-center text-sm font-semibold"
      >
        Télécharger mes données
      </a>
      <Link href="/confidentialite" className="block text-center text-xs font-semibold text-dim underline underline-offset-2">
        Politique de confidentialité
      </Link>

      {isClient && !confirming && (
        <button onClick={() => setConfirming(true)} className="w-full py-2 text-xs font-semibold text-danger underline underline-offset-2">
          Supprimer mon compte
        </button>
      )}
      {isClient && confirming && (
        <div className="space-y-2 rounded-xl border border-danger/40 bg-danger/5 p-3">
          <p className="text-sm">
            Ton compte, ton entraînement, tes messages et tes fichiers seront effacés définitivement. Ton coach en sera prévenu.
            Tape <b>SUPPRIMER</b> pour confirmer.
          </p>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Taper SUPPRIMER pour confirmer" autoComplete="off" />
          {error && <p role="alert" className="text-xs font-semibold text-danger">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setConfirming(false); setTyped(""); }} className="flex-1 rounded-xl bg-surface2 py-2.5 text-sm font-bold">
              Annuler
            </button>
            <button
              onClick={remove}
              disabled={busy || typed.trim().toUpperCase() !== "SUPPRIMER"}
              className="flex-1 rounded-xl bg-danger py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              {busy ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
