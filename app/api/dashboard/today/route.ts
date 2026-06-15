import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionInstance, Goal, ExerciseInstance } from "@/lib/types";

/**
 * GET /api/dashboard/today
 *
 * Route en LECTURE SEULE, destinée au dashboard mural domestique (iPad + proxy Flask local).
 * Renvoie, pour une liste fixe de sportifs (définie par variable d'env, jamais par le client),
 * la séance du jour (fuseau Europe/Paris) ou « repos » + le prochain objectif (décompte J-x).
 *
 * Sécurité :
 *  - Protégée par un secret partagé : header `Authorization: Bearer <DASHBOARD_SECRET>`
 *    (même motif que /api/cron/reminders). Absent → 503, mauvais → 401.
 *  - Les emails autorisés sont FIXÉS côté serveur (`DASHBOARD_EMAILS`) : le client ne peut
 *    pas demander les données d'un autre sportif.
 *  - Données renvoyées volontairement MINIMALES (ni email exposé hors écho, ni santé, ni chat…).
 *
 * Performance / quota Supabase :
 *  - Lecture de SOUS-CHAMPS uniquement (`data->sessions`, `data->goals`), pas du blob entier.
 *  - Le proxy Flask met le résultat en cache (rafraîchi quelques fois par jour) → charge négligeable.
 */

export const dynamic = "force-dynamic";

/** Date du jour au format YYYY-MM-DD dans le fuseau Europe/Paris. */
function parisDateStr(d: Date): string {
  // en-CA → "YYYY-MM-DD"
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Nombre de jours calendaires entre deux dates "YYYY-MM-DD" (toB - fromA). */
function daysBetween(fromA: string, toB: string): number {
  const a = Date.parse(fromA + "T00:00:00Z");
  const b = Date.parse(toB + "T00:00:00Z");
  if (isNaN(a) || isNaN(b)) return NaN;
  return Math.round((b - a) / 86400000);
}

/** Réduit un exercice à l'essentiel pour l'affichage mural. */
function slimExercise(ex: ExerciseInstance) {
  return {
    name: ex.name,
    sets: ex.setsLabel || (ex.sets ? String(ex.sets) : ""),
    reps: ex.repsLabel || (ex.reps ? String(ex.reps) : ""),
    // weightLabel (allure CAP) prioritaire sur le poids chiffré ; 0 = non prescrit
    weight: ex.weightLabel || (ex.weight ? String(ex.weight) : ""),
    rpe: ex.rpeCoach ? String(ex.rpeCoach) : "",
    comment: ex.coachComment || "",
  };
}

export async function GET(req: NextRequest) {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) {
    // Variable non configurée — refuser systématiquement (jamais de fausse ouverture).
    return NextResponse.json({ error: "DASHBOARD_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Emails autorisés, FIXÉS côté serveur (ordre préservé pour l'affichage : Antoine | Leelou).
  const emails = (process.env.DASHBOARD_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) {
    return NextResponse.json({ error: "DASHBOARD_EMAILS not configured" }, { status: 503 });
  }

  const admin = createAdminClient();
  const todayStr = parisDateStr(new Date());

  // 1) Résoudre email → (id, name). Lecture minimale.
  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id, email, name")
    .in("email", emails);

  if (pErr) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  const byEmail = new Map<string, { id: string; name: string }>();
  for (const p of profiles ?? []) {
    byEmail.set(String(p.email).toLowerCase(), { id: p.id as string, name: (p.name as string) || "" });
  }

  const ids = Array.from(byEmail.values()).map((v) => v.id);

  // 2) Charger uniquement les sous-champs sessions + goals des sportifs concernés.
  const stateById = new Map<string, { sessions: SessionInstance[]; goals: Goal[] }>();
  if (ids.length > 0) {
    const { data: rows } = await admin
      .from("app_state")
      .select("user_id, sessions:data->sessions, goals:data->goals")
      .in("user_id", ids);

    for (const row of rows ?? []) {
      stateById.set(String(row.user_id), {
        sessions: (row.sessions ?? []) as unknown as SessionInstance[],
        goals: (row.goals ?? []) as unknown as Goal[],
      });
    }
  }

  // 3) Construire la réponse, dans l'ordre des emails configurés.
  const athletes = emails.map((email) => {
    const prof = byEmail.get(email);
    if (!prof) {
      // Email inconnu dans l'app → bloc vide propre (pas d'erreur bloquante).
      return { name: email, found: false, rest: true, sessions: [], nextGoal: null };
    }
    const state = stateById.get(prof.id) ?? { sessions: [], goals: [] };

    // Séance(s) du jour (Paris). On garde aussi les séances validées (affichage « fait »).
    const todaySessions = (state.sessions || [])
      .filter((s) => s && s.date === todayStr)
      .map((s) => ({
        name: s.name || "Séance",
        color: s.color || "",
        done: !!s.done,
        exercises: (s.exercises || []).map(slimExercise),
      }));

    // Prochain objectif à venir (date >= aujourd'hui), le plus proche.
    let nextGoal: { competition: string; date: string; place: string; daysUntil: number } | null = null;
    const upcoming = (state.goals || [])
      .filter((g) => g && g.date && daysBetween(todayStr, g.date) >= 0)
      .sort((a, b) => daysBetween(todayStr, a.date) - daysBetween(todayStr, b.date));
    if (upcoming.length > 0) {
      const g = upcoming[0];
      nextGoal = {
        competition: g.competition || "Objectif",
        date: g.date,
        place: g.place || "",
        daysUntil: daysBetween(todayStr, g.date),
      };
    }

    return {
      name: prof.name || email,
      found: true,
      rest: todaySessions.length === 0,
      sessions: todaySessions,
      nextGoal,
    };
  });

  const res = NextResponse.json({
    ok: true,
    today: todayStr,
    generatedAt: new Date().toISOString(),
    athletes,
  });
  // Le cache vit côté proxy Flask ; ici on évite tout cache CDN intermédiaire.
  res.headers.set("Cache-Control", "no-store");
  return res;
}
