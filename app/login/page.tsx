"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setGuest } from "@/lib/guest";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!email || !password) {
      setMsg({ text: "Email et mot de passe requis." });
      return;
    }
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) {
        setMsg({ text: error.message });
        setBusy(false);
        return;
      }
      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }
      setMsg({
        text: "Compte créé ✓ Si la confirmation email est active, confirme via l'email reçu puis connecte-toi.",
        ok: true,
      });
      setMode("signin");
      setBusy(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg({ text: error.message });
        setBusy(false);
        return;
      }
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-5">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-[0.2em]">NMRY</h1>
        <p className="text-sm text-dim">Coaching musculation</p>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-4 text-lg font-bold">
          {mode === "signin" ? "Connexion" : "Créer un compte"}
        </h2>

        {mode === "signup" && (
          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs text-dim">Nom</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom Nom" />
          </label>
        )}
        <label className="mb-3 block">
          <span className="mb-1.5 block text-xs text-dim">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs text-dim">Mot de passe</span>
          <input
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500] disabled:opacity-60"
        >
          {busy ? "..." : mode === "signin" ? "Se connecter" : "S'inscrire"}
        </button>

        {msg && (
          <p className={`mt-3 text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>
        )}

        <p className="mt-4 text-center text-sm">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setMsg(null);
            }}
            className="text-accent2"
          >
            {mode === "signin" ? "Pas de compte ? Créer un compte" : "J'ai déjà un compte"}
          </button>
        </p>
      </form>

      {/* Mode invité */}
      <div className="mt-4 flex items-center gap-3 text-xs text-dim">
        <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
      </div>
      <button
        type="button"
        onClick={() => {
          setGuest(true);
          router.replace("/");
          router.refresh();
        }}
        className="mt-4 w-full rounded-xl border border-line bg-surface2 py-3 font-semibold"
      >
        Continuer en invité
      </button>
      <p className="mt-2 text-center text-xs text-dim">Sans compte — données gardées sur cet appareil.</p>
    </main>
  );
}
