/**
 * Pièces jointes du chat (bucket `chat-attachments`, privé) : jamais d'URL publique.
 * Le navigateur passe par /api/chat/media?p=<chemin>, qui vérifie que l'appelant appartient
 * à la conversation puis redirige vers une URL signée de courte durée.
 */
const PUBLIC_MARKER = "/storage/v1/object/public/chat-attachments/";
const PATH_RE = /^[A-Za-z0-9_\-./]+$/;

/** Chemin Storage valide (pas de remontée de dossier, caractères simples). */
export function isMediaPath(p: unknown): p is string {
  return typeof p === "string" && p.length > 0 && p.length < 300 && PATH_RE.test(p) && !p.includes("..") && !p.startsWith("/");
}

export function mediaProxyUrl(path: string): string {
  return `/api/chat/media?p=${encodeURIComponent(path)}`;
}

/**
 * Adresse à afficher pour une pièce jointe : les anciennes URL publiques sont converties
 * vers le relais authentifié ; data:… (vocal de secours) et relais déjà formé sont gardés.
 */
export function mediaSrc(url: string | null | undefined, path?: string | null): string | undefined {
  if (path && isMediaPath(path)) return mediaProxyUrl(path);
  if (!url) return undefined;
  const i = url.indexOf(PUBLIC_MARKER);
  if (i >= 0) {
    const p = decodeURIComponent(url.slice(i + PUBLIC_MARKER.length).split("?")[0]);
    return isMediaPath(p) ? mediaProxyUrl(p) : undefined;
  }
  if (url.startsWith("/api/chat/media?") || url.startsWith("data:audio/") || url.startsWith("data:image/")) return url;
  return undefined; // toute autre adresse externe est ignorée (pas de pixel espion)
}
