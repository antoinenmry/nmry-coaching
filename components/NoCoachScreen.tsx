"use client";

import { useCallback, useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";

/**
 * Écran affiché aux sportifs dont l'inscription n'est pas encore validée par un coach.
 * Aucune donnée de l'app n'est accessible tant que le coach n'a pas accepté la demande.
 * Vérifie régulièrement (et au retour sur l'app) : dès l'acceptation, l'app se recharge déverrouillée.
 */
export default function NoCoachScreen() {
  const { me, signOut } = useData();
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/me/has-coach", { cache: "no-store" });
      if (res.ok && (await res.json()).hasCoach) window.location.reload();
    } catch {
      /* réseau : on réessaiera */
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const t = setInterval(check, 15000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [check]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-6 text-center">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-6xl">⏳</div>
        <h1 className="mb-2 text-2xl font-black">Inscription en attente de validation</h1>
        <p className="mb-2 text-dim">
          Merci{me?.name ? ` ${me.name.split(" ")[0]}` : ""}, ta demande a bien été envoyée.
        </p>
        <p className="mb-8 text-sm text-dim">
          Ton coach doit accepter ton profil avant de t&apos;ouvrir l&apos;accès. Dès que c&apos;est fait,
          l&apos;application se débloque automatiquement.
        </p>

        <div className="mb-8 rounded-2xl border border-line bg-surface p-4 text-left">
          <p className="mb-2 text-sm font-semibold">Où en est-on ?</p>
          <ul className="space-y-2 text-sm text-dim">
            <li>✅ Ton compte est créé</li>
            <li>🔔 Ton coach a été prévenu</li>
            <li>⏳ Il doit valider ton profil</li>
            <li>🔓 L&apos;accès s&apos;ouvre ensuite automatiquement</li>
          </ul>
        </div>

        <button
          onClick={check}
          disabled={checking}
          className="mb-3 w-full rounded-xl bg-accent py-3 text-sm font-bold text-[#1a1500] disabled:opacity-60"
        >
          {checking ? "Vérification…" : "Vérifier maintenant"}
        </button>
        <button onClick={signOut} className="w-full rounded-xl bg-surface2 py-3 text-sm font-semibold text-dim">
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
