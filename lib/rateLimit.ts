// Limiteur de débit en mémoire (fenêtre fixe).
//
// Best-effort sur serverless : protège des rafales sur une instance « chaude »
// (Vercel réutilise le process entre requêtes proches), reset au cold start.
// Suffisant pour borner un abus accidentel ou un spam ponctuel sur les routes
// d'envoi (email urgent, broadcasts, push de test). Volontairement SANS base de
// données → n'ajoute aucun egress/Disk IO Supabase.

type Hit = { count: number; resetAt: number };

const store = new Map<string, Hit>();
let lastCleanup = Date.now();

/**
 * Autorise au plus `limit` appels par fenêtre de `windowMs` pour une `key` donnée
 * (typiquement `"<bucket>:<userId>"`).
 * @returns `ok` = autorisé ; `retryAfter` = secondes avant réessai si refusé.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now();

  // Purge occasionnelle des entrées expirées (évite une croissance non bornée).
  if (now - lastCleanup > 60_000) {
    lastCleanup = now;
    for (const [k, v] of store) if (now >= v.resetAt) store.delete(k);
  }

  const hit = store.get(key);
  if (!hit || now >= hit.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (hit.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((hit.resetAt - now) / 1000) };
  }
  hit.count++;
  return { ok: true, retryAfter: 0 };
}
