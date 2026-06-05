/* =========================================================================
   BIBLIOTHÈQUE — Édite UNIQUEMENT ce fichier pour ajouter du contenu.

   1) EXERCISES : tous les mouvements disponibles. Une ligne = un exercice.
   2) SESSION_TEMPLATES : modèles de séances à glisser dans le planning.
   ========================================================================= */

import type { SessionInstance, ExerciseInstance } from "./types";

export interface Exercise {
  id: string;
  name: string;
  group: string;
}

export interface SessionTemplate {
  id: string;
  name: string;
  color: string;
  exercises: { exId: string; sets: number; reps: number; weight: number; rpe: number }[];
}

// ---- 1) Exercices ----------------------------------------------------------
export const EXERCISES: Exercise[] = [
  // Pectoraux
  { id: "bench", name: "Développé couché", group: "Pectoraux" },
  { id: "incline-db", name: "Développé incliné haltères", group: "Pectoraux" },
  { id: "dips", name: "Dips", group: "Pectoraux" },
  { id: "pec-fly", name: "Écarté poulie", group: "Pectoraux" },
  // Dos
  { id: "deadlift", name: "Soulevé de terre", group: "Dos" },
  { id: "pullup", name: "Tractions", group: "Dos" },
  { id: "row-barbell", name: "Rowing barre", group: "Dos" },
  { id: "lat-pulldown", name: "Tirage vertical", group: "Dos" },
  // Jambes
  { id: "squat", name: "Squat", group: "Jambes" },
  { id: "leg-press", name: "Presse à cuisses", group: "Jambes" },
  { id: "rdl", name: "Soulevé de terre roumain", group: "Jambes" },
  { id: "leg-curl", name: "Leg curl", group: "Jambes" },
  { id: "calf-raise", name: "Mollets debout", group: "Jambes" },
  // Épaules
  { id: "ohp", name: "Développé militaire", group: "Épaules" },
  { id: "lateral-raise", name: "Élévations latérales", group: "Épaules" },
  { id: "face-pull", name: "Face pull", group: "Épaules" },
  // Bras
  { id: "curl-barbell", name: "Curl barre", group: "Bras" },
  { id: "curl-db", name: "Curl haltères", group: "Bras" },
  { id: "triceps-push", name: "Extension triceps poulie", group: "Bras" },
  // Gainage
  { id: "plank", name: "Gainage", group: "Gainage" },
  { id: "crunch", name: "Crunch", group: "Gainage" },
];

// ---- 2) Modèles de séances --------------------------------------------------
export const SESSION_TEMPLATES: SessionTemplate[] = [
  {
    id: "push",
    name: "Push (Pecs / Épaules / Triceps)",
    color: "#ef5350",
    exercises: [
      { exId: "bench", sets: 4, reps: 8, weight: 60, rpe: 8 },
      { exId: "incline-db", sets: 3, reps: 10, weight: 22, rpe: 8 },
      { exId: "ohp", sets: 3, reps: 10, weight: 35, rpe: 8 },
      { exId: "lateral-raise", sets: 4, reps: 15, weight: 10, rpe: 9 },
      { exId: "triceps-push", sets: 3, reps: 12, weight: 25, rpe: 9 },
    ],
  },
  {
    id: "pull",
    name: "Pull (Dos / Biceps)",
    color: "#42a5f5",
    exercises: [
      { exId: "deadlift", sets: 4, reps: 5, weight: 100, rpe: 8 },
      { exId: "pullup", sets: 4, reps: 8, weight: 0, rpe: 8 },
      { exId: "row-barbell", sets: 3, reps: 10, weight: 50, rpe: 8 },
      { exId: "face-pull", sets: 3, reps: 15, weight: 20, rpe: 9 },
      { exId: "curl-barbell", sets: 3, reps: 12, weight: 25, rpe: 9 },
    ],
  },
  {
    id: "legs",
    name: "Legs (Jambes)",
    color: "#66bb6a",
    exercises: [
      { exId: "squat", sets: 5, reps: 5, weight: 90, rpe: 8 },
      { exId: "rdl", sets: 3, reps: 8, weight: 80, rpe: 8 },
      { exId: "leg-press", sets: 3, reps: 12, weight: 150, rpe: 8 },
      { exId: "leg-curl", sets: 3, reps: 12, weight: 40, rpe: 9 },
      { exId: "calf-raise", sets: 4, reps: 15, weight: 60, rpe: 9 },
    ],
  },
  {
    id: "fullbody",
    name: "Full Body",
    color: "#ab47bc",
    exercises: [
      { exId: "squat", sets: 3, reps: 8, weight: 80, rpe: 7 },
      { exId: "bench", sets: 3, reps: 8, weight: 60, rpe: 7 },
      { exId: "row-barbell", sets: 3, reps: 10, weight: 50, rpe: 7 },
      { exId: "plank", sets: 3, reps: 1, weight: 0, rpe: 8 },
    ],
  },
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(
  EXERCISES.map((e) => [e.id, e]),
);
export const TEMPLATE_BY_ID: Record<string, SessionTemplate> = Object.fromEntries(
  SESSION_TEMPLATES.map((t) => [t.id, t]),
);

const uid = () => Math.random().toString(36).slice(2, 9);

/** Crée une instance indépendante d'une séance à partir d'un modèle. */
export function instanceFromTemplate(tplId: string): SessionInstance {
  const t = TEMPLATE_BY_ID[tplId];
  return {
    id: uid(),
    tplId: t.id,
    name: t.name,
    color: t.color,
    emoji: 0,
    date: null,
    exercises: t.exercises.map(
      (ex): ExerciseInstance => ({
        uid: uid(),
        exId: ex.exId,
        name: EXERCISE_BY_ID[ex.exId]?.name ?? ex.exId,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        rpeCoach: ex.rpe,
        rpeClient: 0,
        clientComment: "",
      }),
    ),
  };
}

// Palette de couleurs pour les séances composées librement.
export const SESSION_COLORS = ["#ef5350", "#42a5f5", "#66bb6a", "#ab47bc", "#ffb300", "#26c6da"];

/** Crée une séance vide (dans la banque « À placer » par défaut). */
export function newSession(name: string, color: string): SessionInstance {
  return { id: uid(), tplId: "", name, color, emoji: 0, date: null, exercises: [] };
}

/** Transforme un exercice de la bibliothèque en instance prescriptible (valeurs par défaut). */
export function exerciseInstanceFromLibrary(ex: { id: string; name: string }): ExerciseInstance {
  return {
    uid: uid(),
    exId: ex.id,
    name: ex.name,
    sets: 3,
    reps: 10,
    weight: 0,
    rpeCoach: 0,
    rpeClient: 0,
    clientComment: "",
  };
}
