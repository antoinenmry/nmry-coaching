"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/DataProvider";
import { AUTH_ENABLED } from "@/lib/config";
import { PRIVACY_CONTACT, PRIVACY_VERSION, consentMetadata } from "@/lib/privacy";

/**
 * Accord à la politique de confidentialité et au traitement des données de santé (RGPD art. 9) :
 * demandé une fois par version, aux comptes existants comme aux nouveaux (invités compris).
 * Tant qu'il n'est pas donné, l'appli reste fermée.
 */
export default function ConsentGate({ children }: { children: React.ReactNode }) {
  const { signOut } = useData();
  const [state, setState] = useState<"checking" | "needed" | "ok">(AUTH_ENABLED ? "checking" : "ok");
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!AUTH_ENABLED) return;
    createClient().auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as { privacy_version?: string } | undefined;
      setState(!data.user || meta?.privacy_version === PRIVACY_VERSION ? "ok" : "needed");
    });
  }, []);

  async function accept() {
    setSaving(true);
    setError(null);
    const { error: err } = await createClient().auth.updateUser({ data: consentMetadata() });
    if (err) setError("L'enregistrement a échoué. Vérifie ta connexion et réessaie.");
    else setState("ok");
    setSaving(false);
  }

  if (state === "ok") return <>{children}</>;
  if (state === "checking") return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-5">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-line bg-surface p-6">
        <h1 className="text-xl font-black">Tes données, ton accord</h1>
        <p className="text-sm text-dim">
          Pour te coacher, l&apos;appli conserve ton entraînement et des données de santé (blessures, poids,
          ressenti). Seul ton coach y a accès. Tu peux les télécharger ou supprimer ton compte à tout moment.
        </p>
        <Link href="/confidentialite" className="block text-sm font-bold text-accent underline underline-offset-2">
          Lire la politique de confidentialité
        </Link>
        <label className="flex items-start gap-3 rounded-2xl bg-surface2 p-3 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#ffb300]"
          />
          <span>J&apos;accepte la politique de confidentialité et le traitement de mes données de santé pour le suivi par mon coach.</span>
        </label>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <button
          onClick={accept}
          disabled={!checked || saving}
          className="w-full rounded-full bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] py-3 text-sm font-black text-[#1a1500] disabled:opacity-40"
        >
          {saving ? "Enregistrement…" : "Continuer"}
        </button>
        <button onClick={signOut} className="w-full rounded-full bg-surface2 py-3 text-sm font-bold text-dim">
          Refuser et me déconnecter
        </button>
        <p className="text-xs text-dim">
          Si tu refuses, tu ne peux pas utiliser l&apos;appli. Pour faire supprimer ton compte, écris à {PRIVACY_CONTACT}.
        </p>
      </div>
    </div>
  );
}
