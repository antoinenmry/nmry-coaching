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

/** Document complet d'un client (stocké en JSON dans app_state.data). */
export interface AppState {
  profile: UserProfileData;
  planning: Record<string, SessionInstance[]>;
  goals: Goal[];
  followups: Followup[];
}

export const emptyState = (): AppState => ({
  profile: { name: "", age: "", height: "", weight: "", goalWeight: "", diet: "" },
  planning: {},
  goals: [],
  followups: [],
});
