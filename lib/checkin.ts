import type { AppState, Metric } from "@/lib/types";

/** Échelle 1 à 5 pour les trois questions : 5 = le mieux (pour les douleurs : aucune douleur). */
export const CHECKIN_QUESTIONS = [
  { key: "sleep", label: "Sommeil", low: "Très mauvais", high: "Excellent", metricId: "checkin-sleep" },
  { key: "energy", label: "Énergie", low: "À plat", high: "En pleine forme", metricId: "checkin-energy" },
  { key: "pain", label: "Douleurs", low: "Très douloureux", high: "Aucune douleur", metricId: "checkin-pain" },
] as const;
export type CheckinKey = (typeof CHECKIN_QUESTIONS)[number]["key"];
export type CheckinAnswers = Record<CheckinKey, number>;

export const FORM_METRIC_ID = "checkin-form";
const DEFS: { id: string; name: string }[] = [
  { id: FORM_METRIC_ID, name: "Forme" },
  ...CHECKIN_QUESTIONS.map((q) => ({ id: q.metricId, name: q.label })),
];

export const localDateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Une réponse est déjà enregistrée pour ce jour ? */
export function hasCheckin(state: Pick<AppState, "metrics">, date = localDateKey()): boolean {
  return !!state.metrics?.find((m) => m.id === FORM_METRIC_ID)?.entries.some((e) => e.date === date);
}

/**
 * Enregistre les 3 réponses du jour dans les métriques (Sommeil, Énergie, Douleurs) et
 * calcule « Forme » = moyenne des trois. Une seule entrée par jour et par indicateur.
 * Crée les indicateurs au besoin (et Poids/Taille si les métriques n'existaient pas encore,
 * pour ne pas court-circuiter leur initialisation).
 */
export function saveCheckin(d: AppState, a: CheckinAnswers, date = localDateKey()) {
  if (d.metrics === undefined) {
    const w = parseFloat(d.profile.weight ?? "");
    const h = parseFloat(d.profile.height ?? "");
    d.metrics = [
      { id: "metric-poids", name: "Poids", unit: "kg", emoji: "", visible: true, entries: !isNaN(w) && w > 0 ? [{ id: crypto.randomUUID(), date, value: w }] : [] },
      { id: "metric-taille", name: "Taille", unit: "cm", emoji: "", visible: true, entries: !isNaN(h) && h > 0 ? [{ id: crypto.randomUUID(), date, value: h }] : [] },
    ];
  }
  const avg = Math.round(((a.sleep + a.energy + a.pain) / 3) * 10) / 10;
  const values: Record<string, number> = {
    [FORM_METRIC_ID]: avg,
    "checkin-sleep": a.sleep,
    "checkin-energy": a.energy,
    "checkin-pain": a.pain,
  };
  for (const def of DEFS) {
    let m = d.metrics.find((x) => x.id === def.id);
    if (!m) {
      m = { id: def.id, name: def.name, unit: "/5", emoji: "", visible: true, entries: [] } as Metric;
      d.metrics.push(m);
    }
    m.entries = m.entries.filter((e) => e.date !== date);
    m.entries.push({ id: crypto.randomUUID(), date, value: values[def.id] });
    m.entries.sort((x, y) => x.date.localeCompare(y.date));
  }
}
