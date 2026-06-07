"use client";

import { useEffect } from "react";

/**
 * Enregistre le Service Worker au démarrage de l'app (toutes les pages).
 * - Idempotent : si le SW est déjà enregistré, le navigateur réutilise l'existant.
 * - Nécessaire pour recevoir les push notifications même si l'utilisateur n'a
 *   pas visité Settings dans la session courante.
 * - Monté dans (app)/layout.tsx pour couvrir tout le périmètre authentifié.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        console.warn("[SW] Enregistrement échoué :", err);
      });
  }, []);

  return null;
}
