const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Nombre de jours entre aujourd'hui et la date (négatif si passée). null si vide. */
export function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Libellé court de décompte : J-15, Demain, Aujourd'hui, Passé. */
export function countdownLabel(dateStr: string): string {
  const n = daysUntil(dateStr);
  if (n === null) return "Date ?";
  if (n > 1) return `J-${n}`;
  if (n === 1) return "Demain";
  if (n === 0) return "Aujourd'hui";
  return "Passé";
}

export function frenchDate(dateStr: string): string {
  if (!dateStr) return "Date ?";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
