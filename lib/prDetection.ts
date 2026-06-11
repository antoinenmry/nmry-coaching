import type { LibraryExercise, RecordsData } from "./types";

const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

/** Extrait une valeur kg d'un texte libre : "185 kg" → 185, "185" → 185, "5:42" → null */
export function parseWeight(text: string): number | null {
  if (!text?.trim()) return null;
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*kg?/i);
  if (m) {
    const n = parseFloat(m[1].replace(",", "."));
    if (!isNaN(n) && n > 0 && n < 1500) return n;
  }
  // nombre seul sans unité
  const plain = text.trim().replace(",", ".");
  const n = parseFloat(plain);
  if (!isNaN(n) && n > 0 && n < 1500 && /^\d+(?:\.\d+)?$/.test(plain)) return n;
  return null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(1rm|1\s*rm|max|pr|record)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cherche un exercice correspondant au nom (exact puis inclusion partielle) */
export function findMatchingExercise(
  name: string,
  exercises: LibraryExercise[]
): LibraryExercise | null {
  const n = normalize(name);
  if (n.length < 3) return null;
  for (const ex of exercises) {
    if (normalize(ex.name) === n) return ex;
  }
  for (const ex of exercises) {
    const en = normalize(ex.name);
    if (en.length >= 3 && (n.includes(en) || en.includes(n))) return ex;
  }
  return null;
}

/** Retourne le poids max enregistré pour un exercice, ou undefined si aucun record */
export function getMaxRecord(exId: string, records: RecordsData): number | undefined {
  const er = records.strength.find((r) => r.exId === exId);
  if (!er || er.entries.length === 0) return undefined;
  return Math.max(...er.entries.map((e) => e.weight));
}

/** Insère un nouveau record dans le draft records (à appeler dans update()) */
export function saveStrengthRecord(
  records: RecordsData,
  exId: string,
  exName: string,
  weight: number,
  reps: number
): void {
  const entry = { id: uid(), date: today(), reps, weight };
  const idx = records.strength.findIndex((r) => r.exId === exId);
  if (idx >= 0) {
    const entries = [...records.strength[idx].entries, entry]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3);
    records.strength[idx] = { ...records.strength[idx], entries };
  } else {
    records.strength.push({ exId, name: exName, visible: true, entries: [entry] });
  }
}
