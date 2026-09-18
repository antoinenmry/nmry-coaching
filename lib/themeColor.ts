/** Garde-fous de lisibilité pour la couleur de fond personnalisée.
 *
 *  En thème sombre, les cartes, champs et bordures sont calculés à partir du fond
 *  (cf. globals.css). Un fond trop clair donnerait donc des cartes claires sous un
 *  texte clair. On borne la luminance du fond selon le thème, en gardant sa teinte :
 *  le sélecteur de couleur reste libre, le texte reste lisible quoi qu'on choisisse.
 */

export type ThemeName = "dark" | "light" | "aurora";

/** Luminance maximale du fond en thème sombre. Calée par test sur 30 000 couleurs
 *  aléatoires : le texte secondaire (--color-dim) garde ≥ 5,7:1 sur les champs, et le
 *  rouge d'erreur ne tombe jamais sous son contraste actuel (~4,2:1). Juste au-dessus
 *  du preset le plus clair (0,0063) : les 6 fonds proposés ne sont jamais modifiés. */
export const DARK_MAX_LUMINANCE = 0.0065;
/** Luminance minimale du fond en thème clair (texte foncé sur fond clair). */
export const LIGHT_MIN_LUMINANCE = 0.8;

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
}

/** Luminance relative WCAG 2.x. */
export function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mélange sRGB, identique à `color-mix(in srgb, a, b pct%)`. */
export function mix(a: RGB, b: RGB, pctB: number): RGB {
  return [0, 1, 2].map((i) => a[i] * (1 - pctB) + b[i] * pctB) as RGB;
}

/** Ramène `hex` dans la plage de luminance lisible pour `theme`, en gardant la teinte.
 *  Renvoie la couleur inchangée si elle convient déjà, ou si elle est illisible (non-hex). */
export function clampBgForTheme(hex: string, theme: ThemeName): string {
  const rgb = hexToRgb(hex);
  if (!rgb || theme === "aurora") return hex;

  if (theme === "dark") {
    if (luminance(rgb) <= DARK_MAX_LUMINANCE) return hex;
    // Assombrit (mélange vers le noir) jusqu'au seuil — recherche dichotomique.
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) {
      const k = (lo + hi) / 2;
      if (luminance(mix(rgb, [0, 0, 0], k)) > DARK_MAX_LUMINANCE) lo = k; else hi = k;
    }
    return rgbToHex(mix(rgb, [0, 0, 0], hi));
  }

  if (luminance(rgb) >= LIGHT_MIN_LUMINANCE) return hex;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const k = (lo + hi) / 2;
    if (luminance(mix(rgb, [255, 255, 255], k)) < LIGHT_MIN_LUMINANCE) lo = k; else hi = k;
  }
  return rgbToHex(mix(rgb, [255, 255, 255], hi));
}

export { hexToRgb };
