"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setMsg({ text: "Le mot de passe doit faire au moins 6 caractères." });
      return;
    }
    if (password !== confirm) {
      setMsg({ text: "Les deux mots de passe ne correspondent pas." });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg({ text: error.message });
      setBusy(false);
      return;
    }
    setMsg({ text: "Mot de passe mis à jour ✓ Redirection…", ok: true });
    setTimeout(() => router.replace("/"), 1500);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-5">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-[0.2em]">NMRY</h1>
        <p className="text-sm text-dim">Coaching musculation</p>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-4 text-lg font-bold">Nouveau mot de passe</h2>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-xs text-dim">Nouveau mot de passe</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Au moins 6 caractères"
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs text-dim">Confirmer le mot de passe</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500] disabled:opacity-60"
        >
          {busy ? "…" : "Enregistrer"}
        </button>

        {msg && (
          <p className={`mt-3 text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>
        )}
      </form>
    </main>
  );
}
