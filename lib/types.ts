export type Role = "coach" | "client";

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** Un exercice dans une séance posée (valeurs éditables). */
export interface ExerciseInstance {
  uid: string;
  exId: string;
  sets: number;
  reps: number;
  weight: number;
  rpe: number;
  validated: boolean;
}

/** Une séance posée sur un jour du planning. */
export interface SessionInstance {
  id: string;
  tplId: string;
  name: string;
  color: string;
  exercises: ExerciseInstance[];
}

export interface UserProfileData {
  name: string;
  age: string;
  height: string;
  weight: string;
  goalWeight: string;
  diet: string;
}

export interface Goal {
  id: string;
  competition: string;
  date: string;
  place: string;
  expected: string;
}

export interface Followup {
  id: string;
  date: string;
  type: "note" | "injury";
  text: string;
}

// ---- Bibliothèque d'exercices (filtres personnalisables) ----

/** Une option de filtre, ex. « Haut du corps ». */
export interface FilterOption {
  id: string;
  label: string;
}

/** Une catégorie de filtre = une ligne de chips, ex. « Zone du corps ». */
export interface FilterCategory {
  id: string;
  name: string;
  options: FilterOption[];
}

/** Un exercice de la bibliothèque (fiche complète). */
export interface LibraryExercise {
  id: string;
  name: string;
  tags: Record<string, string>; // categoryId -> optionId
  sets: number;
  reps: number;
  rpe: number;
  tempo: string; // ex. "3-0-1"
  rest: string; // ex. "90s"
  notes: string;
  video: string; // URL
}

export interface ExerciseLibrary {
  categories: FilterCategory[];
  exercises: LibraryExercise[];
}

/** Document complet d'un client (stocké en JSON dans app_state.data). */
export interface AppState {
  profile: UserProfileData;
  planning: Record<string, SessionInstance[]>;
  goals: Goal[];
  followups: Followup[];
  library: ExerciseLibrary;
}

// Bibliothèque de départ (catégories muscu modifiables/supprimables).
const defaultLibrary = (): ExerciseLibrary => ({
  categories: [
    {
      id: "zone",
      name: "Zone du corps",
      options: [
        { id: "haut", label: "Haut du corps" },
        { id: "bas", label: "Bas du corps" },
        { id: "core", label: "Tronc / Core" },
      ],
    },
    {
      id: "muscle",
      name: "Groupe musculaire",
      options: [
        { id: "pecs", label: "Pectoraux" },
        { id: "dos", label: "Dos" },
        { id: "epaules", label: "Épaules" },
        { id: "bras", label: "Bras" },
        { id: "jambes", label: "Jambes" },
        { id: "fessiers", label: "Fessiers" },
        { id: "abdos", label: "Abdos" },
      ],
    },
    {
      id: "equip",
      name: "Équipement",
      options: [
        { id: "barre", label: "Barre" },
        { id: "halteres", label: "Haltères" },
        { id: "poulie", label: "Poulie" },
        { id: "machine", label: "Machine" },
        { id: "pdc", label: "Poids du corps" },
      ],
    },
  ],
  exercises: [
    {
      id: "ex-bench",
      name: "Développé couché",
      tags: { zone: "haut", muscle: "pecs", equip: "barre" },
      sets: 4, reps: 8, rpe: 8, tempo: "3-0-1", rest: "120s", notes: "", video: "",
    },
    {
      id: "ex-squat",
      name: "Squat",
      tags: { zone: "bas", muscle: "jambes", equip: "barre" },
      sets: 5, reps: 5, rpe: 8, tempo: "3-0-1", rest: "180s", notes: "", video: "",
    },
    {
      id: "ex-pullup",
      name: "Tractions",
      tags: { zone: "haut", muscle: "dos", equip: "pdc" },
      sets: 4, reps: 8, rpe: 8, tempo: "2-0-1", rest: "120s", notes: "", video: "",
    },
  ],
});

export const emptyState = (): AppState => ({
  profile: { name: "", age: "", height: "", weight: "", goalWeight: "", diet: "" },
  planning: {},
  goals: [],
  followups: [],
  library: defaultLibrary(),
});
