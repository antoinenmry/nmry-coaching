"use client";

/**
 * PushSubscribeButton
 * Bouton pour activer/désactiver les notifications push.
 * Enregistre le service worker et sauvegarde la souscription en base.
 */

import { useEffect, useState } from "react";

type PushState = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushSubscribeButton() {
  const [state, setState] = useState<PushState>("loading");
  const [swReg, setSwReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        setSwReg(reg);
        const perm = Notification.permission;
        if (perm === "denied") { setState("denied"); return; }

        const existing = await reg.pushManager.getSubscription();
        setState(existing ? "subscribed" : "unsubscribed");
      })
      .catch(() => setState("unsupported"));
  }, []);

  async function subscribe() {
    if (!swReg) return;
    setState("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState("denied"); return; }

      const sub = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      setState("subscribed");
    } catch (e) {
      console.error("[push] subscribe error:", e);
      setState("unsubscribed");
    }
  }

  async function unsubscribe() {
    if (!swReg) return;
    setState("loading");
    try {
      const sub = await swReg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("unsubscribed");
    } catch (e) {
      console.error("[push] unsubscribe error:", e);
      setState("subscribed");
    }
  }

  if (state === "unsupported") return null;

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Notifications push</p>
        <p className="text-[12px] text-dim">
          {state === "subscribed"
            ? "Activées sur cet appareil"
            : state === "denied"
            ? "Bloquées par le navigateur"
            : "Désactivées sur cet appareil"}
        </p>
      </div>
      {state === "denied" ? (
        <span className="text-[12px] text-dim">Bloqué</span>
      ) : (
        <button
          onClick={state === "subscribed" ? unsubscribe : subscribe}
          disabled={state === "loading"}
          className={`rounded-xl px-3 py-2 text-[12px] font-semibold transition disabled:opacity-50 ${
            state === "subscribed"
              ? "bg-ok/15 text-ok hover:bg-ok/25"
              : "bg-accent/15 text-accent hover:bg-accent/25"
          }`}
        >
          {state === "loading" ? "…" : state === "subscribed" ? "✅ Activées" : "Activer"}
        </button>
      )}
    </div>
  );
}
