/** « jean-pierre d'AUBIGNY » → « Jean-Pierre D'Aubigny » : majuscule à chaque mot, après un tiret ou une apostrophe. */
export function capitalizeName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr-FR")
    .replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("fr-FR"));
}
