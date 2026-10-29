import type { ExerciseLibrary, ExerciseValueType, LibraryExercise } from "@/lib/types";

/** Libellés affichés dans la liste déroulante et sur les champs. */
export const VALUE_TYPE_LABEL: Record<ExerciseValueType, string> = {
  load: "kg/RPE/%",
  pace: "min/km",
  speed: "km/h",
};

// Repli historique : un exercice sans type explicite dont le nom évoque la course/le cardio s'exprime en allure.
const CARDIO_NAME = /cardio|course|running|footing|jogging|trail|allure|endurance/i;

/** Type déduit pour un exercice SANS `valueType` (anciens exercices) : étiquette « allure » ou nom cardio → min/km. */
export function legacyValueType(
  ex: Pick<LibraryExercise, "name" | "tags"> | undefined,
  name: string,
  paceOptionIds: Set<string>,
): ExerciseValueType {
  const tagged = ex ? Object.values(ex.tags).flat().some((t) => paceOptionIds.has(t)) : false;
  return tagged || CARDIO_NAME.test(ex?.name ?? name) ? "pace" : "load";
}

/** Retourne la fonction (exId, nom) → type de valeur attendu. Le choix explicite du coach prime toujours. */
export function valueTypeResolver(library: Pick<ExerciseLibrary, "exercises" | "categories">) {
  const paceOptionIds = new Set<string>();
  library.categories.forEach((c) => c.options.forEach((o) => { if (o.isPace) paceOptionIds.add(o.id); }));
  const byId = new Map(library.exercises.map((e) => [e.id, e]));
  return (exId: string, name = ""): ExerciseValueType => {
    const ex = byId.get(exId);
    return ex?.valueType ?? legacyValueType(ex, name, paceOptionIds);
  };
}

/** Allure en minutes décimales → « 5 min 30 s/km ». */
export function fmtPace(minutes: number): string {
  if (!minutes || minutes <= 0) return "";
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return s === 60 ? `${m + 1} min 00 s/km` : `${m} min ${s.toString().padStart(2, "0")} s/km`;
}

/** « 12,5 km/h » */
export function fmtSpeed(kmh: number): string {
  return kmh > 0 ? `${String(Math.round(kmh * 10) / 10).replace(".", ",")} km/h` : "";
}

/** Valeur numérique + unité du type : 80 → « 80 kg », 5.5 → « 5 min 30 s/km », 12 → « 12 km/h ». */
export function fmtValue(type: ExerciseValueType, v: number): string {
  if (!v || v <= 0) return "";
  return type === "pace" ? fmtPace(v) : type === "speed" ? fmtSpeed(v) : `${v} kg`;
}
