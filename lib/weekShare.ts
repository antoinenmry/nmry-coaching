// Synthèse hebdomadaire pour l'image « Partager ma semaine » (bouton de l'en-tête de /plan).
import type { ExerciseInstance, ExerciseValueType, SessionInstance } from "./types";
import { fmtSpeed } from "./exerciseUnit";

export type ShareExercise = { key: string; name: string; sr: string; load: string; loadValue: number };
export type WeekSummary = {
  label: string;       // « Semaine du 26 oct. au 1er nov. »
  count: number;       // séances validées
  minutes: number;     // durée totale (chrono + estimation)
  estimated: boolean;  // au moins une séance sans durée → total approximatif
  exercises: ShareExercise[];
};

const MO = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (d: Date) => (d.getDate() === 1 ? "1er" : String(d.getDate()));
const num = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");
// Minutes décimales (5.5) → « 5:30 »
const pace = (min: number) => `${Math.floor(min)}:${String(Math.round((min % 1) * 60)).padStart(2, "0")}`;
/** Estimation pour une séance validée sans chrono : ~3 min par série de travail. */
const MIN_PER_SET = 3;

export function weekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const same = monday.getMonth() === sunday.getMonth();
  return same
    ? `Semaine du ${day(monday)} au ${day(sunday)} ${MO[sunday.getMonth()]}`
    : `Semaine du ${day(monday)} ${MO[monday.getMonth()]} au ${day(sunday)} ${MO[sunday.getMonth()]}`;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

const workLogs = (ex: ExerciseInstance) => (ex.setLogs ?? []).filter((l) => l.kind !== "warmup" && (l.w > 0 || l.r > 0));

function setCount(ex: ExerciseInstance): number {
  const logs = workLogs(ex);
  return logs.length || ex.sets || 0;
}

// Séries × reps + charge : ce qui a été réellement fait (séries saisies, poids réalisé) prime sur la prescription.
function describe(ex: ExerciseInstance, type: ExerciseValueType): ShareExercise {
  const isPace = type === "pace";
  const logs = workLogs(ex);
  let sets = ex.setsLabel || (ex.sets ? String(ex.sets) : "");
  let reps = ex.repsLabel || (ex.reps ? String(ex.reps) : "");
  let loadValue = 0;
  let load = "";
  if (logs.length) {
    sets = String(logs.length);
    const counts = new Map<number, number>();
    logs.forEach((l) => l.r > 0 && counts.set(l.r, (counts.get(l.r) ?? 0) + 1));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    if (top) reps = String(top[0]);
    loadValue = Math.max(...logs.map((l) => l.w));
  }
  if (!loadValue) loadValue = ex.weightClient || ex.weight || 0;
  if (isPace) load = ex.weightClient ? `${pace(ex.weightClient)} /km` : ex.weightLabel ?? "";
  else if (type === "speed") load = ex.weightClient ? fmtSpeed(ex.weightClient) : ex.weightLabel ?? "";
  else if (loadValue > 0) load = `${num(loadValue)} kg`;
  else if (ex.weightLabel && !/%|rpe/i.test(ex.weightLabel)) load = ex.weightLabel;
  const sr = sets && reps ? `${sets} × ${reps}` : sets ? `${sets} séries` : "";
  return { key: ex.exId || ex.uid, name: ex.name, sr, load, loadValue: type === "load" ? loadValue : 0 };
}

export function summarizeWeek(sessions: SessionInstance[], monday: Date, typeOf: (exId: string, name: string) => ExerciseValueType): WeekSummary {
  const from = ymd(monday);
  const end = new Date(monday);
  end.setDate(monday.getDate() + 6);
  const to = ymd(end);
  const done = sessions.filter((s) => s.done && s.date && s.date >= from && s.date <= to);

  let minutes = 0;
  let estimated = false;
  done.forEach((s) => {
    if (s.durationMin && s.durationMin > 0) minutes += s.durationMin;
    else {
      estimated = true;
      minutes += s.exercises.reduce((n, ex) => n + setCount(ex), 0) * MIN_PER_SET;
    }
  });

  // Un exercice fait plusieurs fois dans la semaine : on garde la séance où la charge est la plus haute.
  const byKey = new Map<string, ShareExercise>();
  done.forEach((s) =>
    s.exercises.forEach((ex) => {
      if (ex.failed) return;
      const d = describe(ex, typeOf(ex.exId, ex.name));
      if (!d.sr && !d.load) return;
      const prev = byKey.get(d.key);
      if (!prev || d.loadValue > prev.loadValue) byKey.set(d.key, d);
    }),
  );
  const exercises = [...byKey.values()].sort((a, b) => b.loadValue - a.loadValue);

  return { label: weekLabel(monday), count: done.length, minutes: Math.round(minutes), estimated, exercises };
}
