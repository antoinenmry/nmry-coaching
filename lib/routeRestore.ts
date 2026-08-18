/** Mémorisation de la dernière page visitée, pour la PWA iOS.
 *
 *  iOS purge la vue web d'une PWA mise en arrière-plan au bout de quelques minutes
 *  (ou plus tôt si la mémoire manque). Au retour, l'app redémarre à froid sur
 *  `start_url` (« / ») : l'utilisateur perd la page où il était alors qu'il n'a fait
 *  que changer de musique ou répondre à un SMS. On mémorise donc la route courante
 *  pour la restaurer — mais uniquement si l'absence a été brève.
 */

export const LAST_ROUTE_KEY = "nmry-last-route";

/** Au-delà, on repart de l'accueil : rouvrir l'app le lendemain ne doit pas
 *  atterrir au milieu de la séance de la veille. */
export const MAX_AGE_MS = 15 * 60 * 1000;

export interface SavedRoute {
  path: string;
  ts: number;
}

/** Les routes d'authentification ne sont jamais mémorisées : y revenir n'a aucun
 *  sens une fois connecté. */
export function isRestorablePath(path: string): boolean {
  return path !== "/" && !path.startsWith("/login") && !path.startsWith("/auth");
}

/** Faut-il rediriger vers la route mémorisée ? */
export function shouldRestoreRoute(
  saved: SavedRoute | null,
  { pathname, now, standalone }: { pathname: string; now: number; standalone: boolean },
): boolean {
  // Hors PWA installée, on ne détourne pas la navigation : sur desktop, arriver sur
  // l'accueil doit afficher l'accueil.
  if (!standalone) return false;
  // Uniquement au démarrage à froid sur l'accueil. Une notification ouvre une route
  // précise (ex. /followup) : elle ne doit pas être écrasée.
  if (pathname !== "/") return false;
  if (!saved || typeof saved.path !== "string" || typeof saved.ts !== "number") return false;
  if (!isRestorablePath(saved.path)) return false;
  return now - saved.ts >= 0 && now - saved.ts < MAX_AGE_MS;
}
