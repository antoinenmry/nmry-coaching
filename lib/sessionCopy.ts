import type { ExerciseInstance } from "@/lib/types";

/**
 * Charge (ou allure) « utilisée à S-1 » d'un exercice : le poids saisi par le sportif, sinon le
 * poids le plus lourd de ses séries de travail (le sportif renseigne souvent le détail des séries
 * sans remplir le poids global). 0 = rien à conserver.
 */
export function lastWeekLoad(ex: ExerciseInstance): number {
  const logs = (ex.setLogs ?? []).filter((l) => l.kind !== "warmup" && l.w > 0);
  const maxLog = logs.length > 0 ? Math.max(...logs.map((l) => l.w)) : 0;
  return Math.max(ex.weightClient ?? 0, maxLog);
}
