import type { AppState, Challenge, LibraryExercise, SessionInstance } from "@/lib/types";

// Logique partagée d'évaluation des défis/badges (utilisée par /library, /profile, /accueil).

export function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-${week}`;
}

export function computeStreakWeeks(sessions: SessionInstance[]): number {
  const doneDates = sessions.filter((s) => s.done && s.date).map((s) => s.date!);
  if (!doneDates.length) return 0;
  const weeks = new Set(doneDates.map(isoWeekKey));
  let streak = 0;
  const cursor = new Date();
  while (true) {
    if (weeks.has(isoWeekKey(cursor.toISOString().slice(0, 10)))) {
      streak++;
      cursor.setDate(cursor.getDate() - 7);
    } else break;
  }
  return streak;
}

export function computeChallengeProgress(
  ch: Challenge,
  state: AppState,
): { current: number; target: number; pct: number } {
  const target = ch.condition.value;
  let current = 0;
  switch (ch.condition.type) {
    case "session_count":
      current = state.sessions.filter((s) => s.done).length;
      break;
    case "pr_count":
      current = state.records.strength.reduce((n, ex) => n + ex.entries.length, 0);
      break;
    case "streak_weeks":
      current = computeStreakWeeks(state.sessions);
      break;
    case "goal_achieved":
      current = state.goals.filter((g) => (g.events ?? []).some((e) => e.achieved.trim())).length;
      break;
    case "exercise_weight": {
      // PR = poids maximal enregistré pour l'exercice ciblé (records force).
      const rec = ch.condition.exId
        ? state.records.strength.find((ex) => ex.exId === ch.condition.exId)
        : undefined;
      current = rec ? rec.entries.reduce((max, e) => Math.max(max, e.weight), 0) : 0;
      break;
    }
  }
  return { current, target, pct: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0 };
}

/** Description lisible de la condition d'un défi (« comment l'obtenir »). */
export function conditionText(ch: Challenge, exercises: LibraryExercise[] = []): string {
  const v = ch.condition.value;
  switch (ch.condition.type) {
    case "session_count":
      return `Valider ${v} séance${v > 1 ? "s" : ""}`;
    case "pr_count":
      return `Enregistrer ${v} record${v > 1 ? "s" : ""}`;
    case "streak_weeks":
      return `${v} semaine${v > 1 ? "s" : ""} consécutive${v > 1 ? "s" : ""} avec une séance`;
    case "goal_achieved":
      return `Réaliser ${v} objectif${v > 1 ? "s" : ""}`;
    case "exercise_weight": {
      const name = exercises.find((ex) => ex.id === ch.condition.exId)?.name ?? "un exercice";
      return `Atteindre ${v} kg sur ${name}`;
    }
  }
}

/** Renvoie les IDs des défis dont la condition est désormais remplie et pas encore débloqués. */
export function challengesToUnlock(
  challenges: Challenge[],
  state: AppState,
): string[] {
  const unlockedIds = new Set((state.badges ?? []).map((b) => b.challengeId));
  return challenges
    .filter((ch) => !unlockedIds.has(ch.id) && computeChallengeProgress(ch, state).pct >= 100)
    .map((ch) => ch.id);
}
