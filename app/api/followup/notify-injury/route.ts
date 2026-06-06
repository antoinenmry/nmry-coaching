import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { getUserNotifPrefs } from "@/lib/notifPrefs";

/**
 * POST /api/followup/notify-injury
 * Notifie le coach qu'un sportif vient de déclarer une blessure.
 * Body: { clientId: string, clientName: string, injuryText: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, clientName, injuryText } = await req.json().catch(() => ({}));
  if (injuryText && injuryText.length > 500) {
    return NextResponse.json({ error: "injuryText trop long" }, { status: 400 });
  }
  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

  // Vérifier que clientId correspond bien à l'utilisateur connecté (anti-usurpation)
  if (clientId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: assignment } = await admin
    .from("coach_client")
    .select("coach_id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!assignment?.coach_id) return NextResponse.json({ skipped: true, reason: "no_coach" });

  const prefs = await getUserNotifPrefs(assignment.coach_id);
  if (!prefs.newInjury) return NextResponse.json({ skipped: true, reason: "pref_disabled" });

  await sendPushToUser(assignment.coach_id, {
    title: `🚨 Blessure — ${clientName || "Un sportif"}`,
    body: injuryText?.slice(0, 100) ?? "A déclaré une blessure",
    url: "/overview",
  }).catch(() => {});

  return NextResponse.json({ sent: true });
}
