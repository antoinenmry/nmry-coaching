"use client";

/**
 * NotifPrefsPanel
 * Panneau de gestion des notifications push : activer/désactiver l'abonnement
 * et choisir quelles notifications recevoir.
 */

import { useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";
import type { NotifPrefs } from "@/lib/types";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type SwState = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

const DEFAULTS: NotifPrefs = {
  newMessage: true,
  newPlan: true,
  urgentMessage: true,
  goalReminder: true,
  sessionReminder: true,
};

export default function NotifPrefsPanel() {
  const { role, state, update } = useData();
  const isCoach = role === "coach" || role === "admin";

  const [swState, setSwState] = useState<SwState>("loading");
  const [swReg, setSwReg] = useState<ServiceWorkerRegistration | null>(null);

  const prefs: NotifPrefs = { ...DEFAULTS, ...state.preferences?.notifPrefs };

  function setPref(key: keyof NotifPrefs, value: boolean) {
    update((s) => {
      if (!s.preferences.notifPrefs) s.preferences.notifPrefs = { ...DEFAULTS };
      s.preferences.notifPrefs![key] = value;
    });
  }

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSwState("unsupported"); return;
    }
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      setSwReg(reg);
      if (Notification.permission === "denied") { setSwState("denied"); return; }
      const sub = await reg.pushManager.getSubscription();
      setSwState(sub ? "subscribed" : "unsubscribed");
    }).catch(() => setSwState("unsupported"));
  }, []);

  async function subscribe() {
    if (!swReg) return;
    setSwState("loading");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { setSwState("denied"); return; }
    const sub = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    setSwState("subscribed");
  }

  async function unsubscribe() {
    if (!swReg) return;
    setSwState("loading");
    const sub = await swReg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setSwState("unsubscribed");
  }

  if (swState === "unsupported") return null;

  // Lignes de préférences selon le rôle
  const prefRows: { key: keyof NotifPrefs; label: string; desc: string; forCoach?: boolean; forClient?: boolean }[] = [
    { key: "newMessage",      label: "Nouveau message",        desc: "Message reçu dans le chat",                      forCoach: true, forClient: true },
    { key: "urgentMessage",   label: "Message urgent",         desc: "Un sportif envoie un message urgent",             forCoach: true },
    { key: "newPlan",         label: "Nouveau programme",      desc: "Le coach publie un nouveau programme",            forClient: true },
    { key: "sessionReminder", label: "Rappel séance",          desc: "Séance programmée aujourd'hui (7h du matin)",     forClient: true },
    { key: "goalReminder",    label: "Rappel objectif",        desc: "J-7 et J-1 avant une compétition",                forClient: true },
  ].filter((r) => isCoach ? r.forCoach : r.forClient);

  return (
    <div className="space-y-3">
      {/* Bouton abonnement global */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Notifications push</p>
          <p className="text-[12px] text-dim">
            {swState === "subscribed"   ? "Activées sur cet appareil" :
             swState === "denied"       ? "Bloquées — autoriser dans les réglages du navigateur" :
             swState === "loading"      ? "Chargement…" :
                                          "Désactivées sur cet appareil"}
          </p>
        </div>
        {swState !== "denied" && (
          <button
            onClick={swState === "subscribed" ? unsubscribe : subscribe}
            disabled={swState === "loading"}
            className={`rounded-xl px-3 py-2 text-[12px] font-semibold transition disabled:opacity-50 ${
              swState === "subscribed"
                ? "bg-ok/15 text-ok hover:bg-ok/25"
                : "bg-accent/15 text-accent hover:bg-accent/25"
            }`}
          >
            {swState === "loading" ? "…" : swState === "subscribed" ? "✅ Activées" : "Activer"}
          </button>
        )}
      </div>

      {/* Préférences détaillées (visible seulement si abonné) */}
      {swState === "subscribed" && (
        <>
          <hr className="border-line" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-dim">Je veux être notifié pour…</p>
          <div className="space-y-2.5">
            {prefRows.map((row) => (
              <label key={row.key} className="flex cursor-pointer items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="text-[12px] text-dim">{row.desc}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={prefs[row.key]}
                  onClick={() => setPref(row.key, !prefs[row.key])}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    prefs[row.key] ? "bg-accent" : "bg-surface2 border border-line"
                  }`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    prefs[row.key] ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </button>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
