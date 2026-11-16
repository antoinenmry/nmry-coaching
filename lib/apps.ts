import type { AppShowcase, ExerciseLibrary } from "@/lib/types";

/** Applis affichées tant que Simon ou Antoine n'ont rien modifié dans « Nos applis ». */
export const DEFAULT_APPS: AppShowcase[] = [
  { id: "alluria", name: "Alluria", tagline: "", status: "soon" },
  { id: "chrono-hiit", name: "Chrono-HIIT", tagline: "", status: "soon" },
];

export const appsOf = (library: ExerciseLibrary) => library.apps ?? DEFAULT_APPS;

/** Lien ou image saisis à la main : seules les adresses web passent (jamais `javascript:`). */
export const safeUrl = (url?: string) => (url && /^https?:\/\//i.test(url.trim()) ? url.trim() : undefined);
