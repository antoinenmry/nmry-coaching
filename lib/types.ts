export type Role = "coach" | "client";

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** Un exercice dans une séance posée (la prescription, éditable). */
export interface ExerciseInstance {
  uid: string;
  exId: string; // référence l'exercice de la bibliothèque (ou d'un modèle)
  name: string; // nom figé à l'ajout (robuste si la biblio change)
  sets: number;
  reps: number;
  weight: number;
  rpeCoach: number; // RPE prescrit par le coach (1-10)
  rpeClient: number; // RPE ressenti par le client (0 = non renseigné)
  coachComment: string; // consigne/note du coach pour cet exercice
  clientComment: string; // retour libre du client
}

/** Une séance. `date` = null tant qu'elle est dans la banque « À placer ». */
export interface SessionInstance {
  id: string;
  tplId: string;
  name: string;
  color: string;
  emoji: number; // ressenti global de la séance (0 = non noté, 1-5)
  coachComment: string; // commentaire global du coach pour la séance
  date: string | null; // "YYYY-MM-DD" si placée, null si dans la banque
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

/** Un exercice de la bibliothèque : son identité (la prescription vit dans le plan). */
export interface LibraryExercise {
  id: string;
  name: string;
  tags: Record<string, string>; // categoryId -> optionId
  video: string; // URL
}

export interface ExerciseLibrary {
  categories: FilterCategory[];
  exercises: LibraryExercise[];
}

/** Document complet d'un client (stocké en JSON dans app_state.data). */
export interface AppState {
  profile: UserProfileData;
  sessions: SessionInstance[]; // toutes les séances (date = null si dans la banque)
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
    { id: "ex-bench", name: "Développé couché", tags: { zone: "haut", muscle: "pecs", equip: "barre" }, video: "" },
    { id: "ex-squat", name: "Squat", tags: { zone: "bas", muscle: "jambes", equip: "barre" }, video: "" },
    { id: "ex-pullup", name: "Tractions", tags: { zone: "haut", muscle: "dos", equip: "pdc" }, video: "" },
  ],
});

export const emptyState = (): AppState => ({
  profile: { name: "", age: "", height: "", weight: "", goalWeight: "", diet: "" },
  sessions: [],
  goals: [],
  followups: [],
  library: defaultLibrary(),
});
