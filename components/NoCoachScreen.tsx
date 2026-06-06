"use client";

import { useData } from "@/components/DataProvider";

/**
 * Écran affiché aux sportifs sans coach affecté.
 * Bloque l'accès à l'application jusqu'à qu'un coach les prenne en charge.
 */
export default function NoCoachScreen() {
  const { me, signOut } = useData();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-6 text-center">
      <div className="w-full max-w-sm">

        {/* Icône */}
        <div className="mb-6 text-6xl">⏳</div>

        {/* Titre */}
        <h1 className="mb-2 text-2xl font-black">En attente d&apos;un coach</h1>

        {/* Message */}
        <p className="mb-2 text-dim">
          Ton compte a bien été créé,{me?.name ? ` ${me.name}` : ""}.
        </p>
        <p className="mb-8 text-sm text-dim">
          Un coach va bientôt te prendre en charge et tu recevras une notification dès que c&apos;est fait.
          En attendant, l&apos;application n&apos;est pas encore accessible.
        </p>

        {/* Card info */}
        <div className="mb-8 rounded-2xl border border-line bg-surface p-4 text-left">
          <p className="mb-2 text-sm font-semibold">Que se passe-t-il ?</p>
          <ul className="space-y-2 text-sm text-dim">
            <li>✅ Ton inscription est confirmée</li>
            <li>🔔 Ton coach a été notifié</li>
            <li>⏳ Il doit t&apos;affecter à son groupe</li>
            <li>📱 Tu recevras une notification dès que c&apos;est fait</li>
          </ul>
        </div>

        {/* Déconnexion */}
        <button
          onClick={signOut}
          className="w-full rounded-xl bg-surface2 py-3 text-sm font-semibold text-dim"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
