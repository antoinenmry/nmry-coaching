"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LAST_ROUTE_KEY,
  isRestorablePath,
  shouldRestoreRoute,
  type SavedRoute,
} from "@/lib/routeRestore";

/** Une seule tentative de restauration par CHARGEMENT de page — pas à chaque
 *  navigation client, sinon le bouton « retour à l'accueil » du header renverrait
 *  aussitôt l'utilisateur sur la page qu'il vient de quitter. */
let restoreAttempted = false;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Mémorise la page courante et, au redémarrage à froid de la PWA, y ramène
 *  l'utilisateur si son absence a été brève. Ne rend rien. */
export default function RouteRestore() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!restoreAttempted) {
      restoreAttempted = true;
      let saved: SavedRoute | null = null;
      try {
        const raw = localStorage.getItem(LAST_ROUTE_KEY);
        saved = raw ? (JSON.parse(raw) as SavedRoute) : null;
      } catch {
        saved = null; // stockage illisible ou indisponible → on reste sur l'accueil
      }
      if (shouldRestoreRoute(saved, { pathname, now: Date.now(), standalone: isStandalone() })) {
        router.replace(saved!.path);
        return; // ne pas écraser la route mémorisée par « / » avant d'y être arrivé
      }
    }

    if (!isRestorablePath(pathname)) return;
    try {
      localStorage.setItem(LAST_ROUTE_KEY, JSON.stringify({ path: pathname, ts: Date.now() }));
    } catch {
      /* quota dépassé ou navigation privée → la restauration est simplement inactive */
    }
  }, [pathname, router]);

  return null;
}
