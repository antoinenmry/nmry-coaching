"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SITE_URL = "https://nmry-coaching.vercel.app";

type Screen = "signin" | "signup" | "pending" | "forgot" | "forgot_sent";

function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const urlError = params.get("error");

  const [screen, setScreen] = useState<Screen>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(
    urlError ? { text: "Le lien de confirmation est invalide ou expiré. Reconnecte-toi." } : null,
  );
  const [busy, setBusy] = useState(false);

  function go(s: Screen) {
    setScreen(s);
    setMsg(null);
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!email || !password) {
      setMsg({ text: "Email et mot de passe requis." });
      return;
    }
    setBusy(true);

    if (screen === "signup") {
      if (!name.trim()) {
        setMsg({ text: "Choisis un nom d'utilisateur." });
        setBusy(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: `${SITE_URL}/auth/callback`,
        },
      });
      if (error) {
        setMsg({ text: error.message });
        setBusy(false);
        return;
      }
      if (data.session) {
        // Notifier les coaches/admins (fire-and-forget)
        fetch("/api/auth/on-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userName: name.trim(), userEmail: email }),
        }).catch(() => {});
        router.replace("/");
        router.refresh();
        return;
      }
      // Confirmation email envoyée (pas encore de session — la notif sera envoyée au callback)
      go("pending");
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

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!email) {
      setMsg({ text: "Saisis ton email." });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/auth/callback?next=/auth/reset-password`,
    });
    setBusy(false);
    if (error) {
      setMsg({ text: error.message });
      return;
    }
    go("forgot_sent");
  }

  // --- Écran "e-mail envoyé, confirme ton compte" ---
  if (screen === "pending") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-5">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold tracking-[0.2em]">NMRY</h1>
          <p className="text-sm text-dim">Coaching</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <div className="mb-3 text-4xl">📬</div>
          <h2 className="mb-2 text-lg font-bold">Confirme ton email</h2>
          <p className="mb-4 text-sm text-dim">
            Un lien de confirmation a été envoyé à <strong>{email}</strong>. Clique dessus pour
            activer ton compte, puis reviens te connecter.
          </p>
          <button
            onClick={() => go("signin")}
            className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500]"
          >
            Retour à la connexion
          </button>
        </div>
      </main>
    );
  }

  // --- Écran "lien de reset envoyé" ---
  if (screen === "forgot_sent") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-5">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold tracking-[0.2em]">NMRY</h1>
          <p className="text-sm text-dim">Coaching</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <div className="mb-3 text-4xl">✉️</div>
          <h2 className="mb-2 text-lg font-bold">Email envoyé</h2>
          <p className="mb-4 text-sm text-dim">
            Un lien de réinitialisation a été envoyé à <strong>{email}</strong>. Vérifie aussi les
            spams.
          </p>
          <button
            onClick={() => go("signin")}
            className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500]"
          >
            Retour à la connexion
          </button>
        </div>
      </main>
    );
  }

  // --- Écran "mot de passe oublié" ---
  if (screen === "forgot") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-5">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold tracking-[0.2em]">NMRY</h1>
          <p className="text-sm text-dim">Coaching</p>
        </div>
        <form onSubmit={submitForgot} className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-1 text-lg font-bold">Mot de passe oublié</h2>
          <p className="mb-4 text-xs text-dim">
            Saisis ton email et on t&apos;envoie un lien de réinitialisation.
          </p>
          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs text-dim">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500] disabled:opacity-60"
          >
            {busy ? "…" : "Envoyer le lien"}
          </button>
          {msg && <p className="mt-3 text-sm text-danger">{msg.text}</p>}
          <p className="mt-4 text-center text-sm">
            <button type="button" onClick={() => go("signin")} className="text-accent2">
              Retour à la connexion
            </button>
          </p>
        </form>
      </main>
    );
  }

  // --- Signin / Signup ---
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-5">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-[0.2em]">NMRY</h1>
        <p className="text-sm text-dim">Coaching</p>
      </div>

      <form onSubmit={submitAuth} className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-4 text-lg font-bold">
          {screen === "signin" ? "Connexion" : "Créer un compte"}
        </h2>

        {screen === "signup" && (
          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs text-dim">Nom d&apos;utilisateur</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prénom Nom"
              autoComplete="name"
            />
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

        <label className="mb-1 block">
          <span className="mb-1.5 block text-xs text-dim">Mot de passe</span>
          <input
            type="password"
            autoComplete={screen === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {screen === "signin" && (
          <p className="mb-4 text-right">
            <button
              type="button"
              onClick={() => go("forgot")}
              className="text-xs text-accent2"
            >
              Mot de passe oublié ?
            </button>
          </p>
        )}
        {screen === "signup" && <div className="mb-4" />}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500] disabled:opacity-60"
        >
          {busy ? "…" : screen === "signin" ? "Se connecter" : "S'inscrire"}
        </button>

        {msg && (
          <p className={`mt-3 text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>
        )}

        <p className="mt-4 text-center text-sm">
          <button
            type="button"
            onClick={() => go(screen === "signin" ? "signup" : "signin")}
            className="text-accent2"
          >
            {screen === "signin" ? "Pas de compte ? Créer un compte" : "J'ai déjà un compte"}
          </button>
        </p>
      </form>

    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
