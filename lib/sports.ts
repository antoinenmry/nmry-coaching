import type { ExerciseLibrary } from "@/lib/types";

/** Sports proposés par défaut dans le profil (modifiables par les éditeurs : library.sports). */
export const DEFAULT_SPORTS = [
  "Strongman", "Hybrid", "Powerlifting", "Running",
  "Hyrox", "Trail", "Pilates", "Musculation",
  "Powerbuilding", "Préparation physique",
];

/** Liste active : celle de la bibliothèque, sinon la liste par défaut. */
export function sportsOf(library: Pick<ExerciseLibrary, "sports"> | undefined): string[] {
  const s = library?.sports;
  return Array.isArray(s) && s.length > 0 ? s : DEFAULT_SPORTS;
}

/** Tracés d'icônes (viewBox 24, trait) des sports connus ; les autres reçoivent l'icône par défaut. */
export const SPORT_ICON_PATHS: Record<string, string> = {
  Strongman: "M9 9V7a3 3 0 0 1 6 0v2M6 15a6 6 0 1 0 12 0a6 6 0 1 0-12 0",
  Hybrid: "M4 9h13l-3-3M20 15H7l3 3",
  Powerlifting: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M12 3v3M12 18v3M3 12h3M18 12h3",
  Running: "M12.5 4.5a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 21l3-6-3-3 2-4 4 2 3 3M11 15l3 2v4",
  Hyrox: "M3 18h14l4-3M6 18v-5h8v5M8 13V9h4",
  Trail: "m2 20 7-13 4 7 3-4 6 10z",
  Pilates: "M9.8 6a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0M4 19c3-1 5-4 8-4s5 3 8 4M12 9v6",
  Musculation: "M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12",
  Powerbuilding: "M4 20V11M10 20V4M16 20v-7M2 20h20",
  "Préparation physique": "M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z",
};
export const FALLBACK_SPORT_ICON = "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z";

/** Cible d'annonce « tout un groupe de sport » : "sport:Strongman". */
export const SPORT_TARGET = "sport:";
export const sportTarget = (s: string) => `${SPORT_TARGET}${s}`;
