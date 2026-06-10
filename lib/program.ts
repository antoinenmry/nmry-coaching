import type {
  Program,
  WeekTemplate,
  SessionTemplate,
  SessionInstance,
  ExerciseInstance,
} from "@/lib/types";

const uid = () => crypto.randomUUID();
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Lundi de la semaine contenant `date` (les programmes démarrent toujours un lundi). */
export function mondayOf(date: Date): Date {
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7; // 0 = Lundi … 6 = Dimanche
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Convertit une séance type en instance datée, prête pour le plan d'un sportif. */
function sessionFromTemplate(tpl: SessionTemplate, dateISO: string): SessionInstance {
  return {
    id: uid(),
    tplId: tpl.id,
    name: tpl.name,
    color: tpl.color,
    emoji: 0,
    done: false,
    coachComment: "",
    date: dateISO,
    exercises: tpl.exercises.map((ex): ExerciseInstance => ({
      uid: uid(),
      exId: ex.exId,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      rpeCoach: ex.rpeCoach,
      rpeClient: 0,
      coachComment: ex.coachComment,
      clientComment: "",
      setsLabel: ex.setsLabel,
      repsLabel: ex.repsLabel,
    })),
  };
}

export interface BuildResult {
  sessions: SessionInstance[];
  /** Diagnostics : références de templates introuvables (semaine/séance supprimée). */
  missingWeeks: number;
  missingSessions: number;
}

/**
 * Transforme un programme en séances datées à partir d'une date de départ.
 *
 * - La date de départ est ramenée au lundi de sa semaine (un programme = des semaines pleines).
 * - weekIndex 0 = semaine 1 ; chaque séance tombe sur `lundi + weekIndex*7 + dayIndex`.
 * - Les exercices sont des copies indépendantes (uid neufs) — aucune mutation des templates.
 */
export function buildSessionsFromProgram(
  program: Program,
  weekTemplates: WeekTemplate[],
  sessionTemplates: SessionTemplate[],
  startDate: Date,
): BuildResult {
  const weekById = new Map(weekTemplates.map((w) => [w.id, w]));
  const sessById = new Map(sessionTemplates.map((s) => [s.id, s]));
  const monday = mondayOf(startDate);

  const sessions: SessionInstance[] = [];
  let missingWeeks = 0;
  let missingSessions = 0;

  program.weeks.forEach((pw, weekIndex) => {
    const week = weekById.get(pw.weekTplId);
    if (!week) { missingWeeks++; return; }

    week.days.forEach((day) => {
      day.sessions.forEach((ref) => {
        const tpl = sessById.get(ref.tplId);
        if (!tpl) { missingSessions++; return; }

        const d = new Date(monday);
        d.setDate(monday.getDate() + weekIndex * 7 + day.dayIndex);
        sessions.push(sessionFromTemplate(tpl, ymd(d)));
      });
    });
  });

  return { sessions, missingWeeks, missingSessions };
}

/** Nombre total de séances qu'un programme générera (pour l'aperçu avant injection). */
export function countProgramSessions(program: Program, weekTemplates: WeekTemplate[]): number {
  const weekById = new Map(weekTemplates.map((w) => [w.id, w]));
  return program.weeks.reduce((total, pw) => {
    const week = weekById.get(pw.weekTplId);
    if (!week) return total;
    return total + week.days.reduce((n, day) => n + day.sessions.length, 0);
  }, 0);
}
