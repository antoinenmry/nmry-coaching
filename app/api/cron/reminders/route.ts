import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { getUserNotifPrefs } from "@/lib/notifPrefs";
import type { AppState, SessionInstance, Goal } from "@/lib/types";

/**
 * GET /api/cron/reminders
 * Tournant chaque matin à 7h (Vercel Cron).
 * Pour chaque sportif actif :
 *  - Rappel séance si une séance est programmée aujourd'hui
 *  - Rappel objectif si J-7 ou J-1 avant une compétition
 *
 * Sécurisé par le header Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10); // "YYYY-MM-DD"

  // Date J+7 et J+1 pour les objectifs
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const in1 = new Date(today); in1.setDate(today.getDate() + 1);
  const in7Str = in7.toISOString().slice(0, 10);
  const in1Str = in1.toISOString().slice(0, 10);

  // Récupérer tous les app_state des clients actifs
  const { data: rows } = await admin
    .from("app_state")
    .select("user_id, data");

  if (!rows?.length) return NextResponse.json({ processed: 0 });

  // Filtrer uniquement les clients (pas les coaches)
  const { data: clients } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "client");

  const clientIds = new Set((clients ?? []).map((c) => c.id));

  let pushed = 0;

  await Promise.allSettled(
    rows
      .filter((r) => clientIds.has(r.user_id))
      .map(async (row) => {
        const state = row.data as AppState;
        const userId = row.user_id;
        const prefs = state.preferences?.notifPrefs;
        const wantSession = prefs?.sessionReminder !== false;   // true par défaut
        const wantGoal   = prefs?.goalReminder    !== false;   // true par défaut

        const tasks: Promise<void>[] = [];

        // ── Rappel séance du jour ─────────────────────────────────────────
        if (wantSession) {
          const todaySessions = (state.sessions ?? []).filter(
            (s: SessionInstance) => s.date === todayStr && !s.done
          );
          if (todaySessions.length > 0) {
            const names = todaySessions.map((s) => s.name).join(", ");
            tasks.push(
              sendPushToUser(userId, {
                title: "💪 Séance du jour",
                body: todaySessions.length === 1
                  ? `${names} au programme aujourd'hui`
                  : `${todaySessions.length} séances aujourd'hui : ${names}`,
                url: "/plan",
              }).then(() => { pushed++; }).catch(() => {})
            );
          }
        }

        // ── Rappels objectifs J-7 / J-1 ───────────────────────────────────
        if (wantGoal) {
          for (const goal of (state.goals ?? []) as Goal[]) {
            if (!goal.date) continue;
            const label =
              goal.date === in7Str ? "J-7" :
              goal.date === in1Str ? "Demain !" :
              null;
            if (!label) continue;
            tasks.push(
              sendPushToUser(userId, {
                title: `🎯 ${label} — ${goal.competition}`,
                body: goal.place ? `📍 ${goal.place}` : "Prépare-toi !",
                url: "/goals",
              }).then(() => { pushed++; }).catch(() => {})
            );
          }
        }

        await Promise.allSettled(tasks);
      })
  );

  return NextResponse.json({ processed: rows.length, pushed });
}
