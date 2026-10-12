import type { Announcement, ExerciseLibrary } from "@/lib/types";

/** Pages automatiques du carrousel d'accueil (les annonces sont ajoutées par ailleurs). */
export const AUTO_SLOTS: { id: string; label: string; desc: string; color: string }[] = [
  { id: "birthdays", label: "Anniversaires du jour", desc: "Carte + feu d'artifice le jour J, pour les membres qui partagent", color: "#ffb300" },
  { id: "goals-list", label: "Compétitions à venir", desc: "Liste défilante : sportif, épreuve, date", color: "#66bb6a" },
  { id: "bdays-list", label: "Anniversaires à venir", desc: "Liste défilante des 30 prochains jours", color: "#ffb300" },
  { id: "reminders", label: "Rappels personnels", desc: "Séance du jour, objectif à J-7 (propres à chaque sportif)", color: "#42a5f5" },
];

export const DEFAULT_INTERVAL_SEC = 5;

/** Page (slot) d'une carte : cartes automatiques regroupées, annonces = leur id. */
export function slotOf(itemId: string): string {
  if (itemId.startsWith("bd-")) return "birthdays";
  if (itemId === "list-goals") return "goals-list";
  if (itemId === "list-bdays") return "bdays-list";
  if (itemId.startsWith("rem-")) return "reminders";
  return itemId;
}

/** Ordre complet des pages : ordre choisi d'abord, puis les nouvelles pages dans l'ordre par défaut. */
export function orderedSlots(lib: Pick<ExerciseLibrary, "carousel" | "announcements">): string[] {
  const anns = (lib.announcements ?? []).map((a: Announcement) => a.id);
  const def = ["birthdays", ...anns, "goals-list", "bdays-list", "reminders"];
  const saved = (lib.carousel?.order ?? []).filter((id) => def.includes(id));
  return [...saved, ...def.filter((id) => !saved.includes(id))];
}
