import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { getUserNotifPrefs } from "@/lib/notifPrefs";
import type { ChatMessage } from "@/lib/types";

/** Insère un message plan_update dans le chat d'un client */
async function appendPlanUpdateToChat(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  coachId: string,
  coachName: string,
) {
  const { data: row } = await admin
    .from("app_state").select("data").eq("user_id", clientId).maybeSingle();
  const current = (row?.data ?? {}) as Record<string, unknown>;
  const msgs: ChatMessage[] = (current.messages as ChatMessage[] | undefined) ?? [];
  const chatMsg: ChatMessage = {
    id: crypto.randomUUID(),
    text: "Votre programmation a été mise à jour.",
    isUrgent: false,
    isVoice: false,
    createdAt: new Date().toISOString(),
    senderId: coachId,
    senderName: coachName,
    isRead: false,
    type: "plan_update",
  };
  await admin.from("app_state").upsert({
    user_id: clientId,
    data: { ...current, messages: [...msgs, chatMsg] },
    updated_at: new Date().toISOString(),
  });
}

/**
 * POST /api/plan/notify
 * Corps optionnel : { targetUserId: string }
 *
 * - Si targetUserId fourni → notifie uniquement ce sportif (vérifie qu'il est bien
 *   un client du coach connecté).
 * - Sinon → notifie tous les sportifs du coach (comportement legacy).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Vérifier que l'utilisateur est coach ou admin
  const { data: profile } = await admin
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const coachId = user.id; // capturé avant les fonctions imbriquées (TS narrowing)
  const coachName = profile.name || "Votre coach";
  const body = await req.json().catch(() => ({}));
  const targetUserId: string | undefined = body?.targetUserId;

  const NOTIF_PAYLOAD = {
    title: "🗓️ Nouveau programme disponible",
    body: `${coachName} a mis à jour votre programmation`,
    url: "/plan",
  };

  /** Met à jour planNotifSentAt dans l'app_state du coach pour les clientIds donnés. */
  async function updateCoachPlanNotif(clientIds: string[]) {
    const { data: coachRow } = await admin
      .from("app_state").select("data").eq("user_id", coachId).maybeSingle();
    const coachData = (coachRow?.data ?? {}) as Record<string, unknown>;
    const coachPrefs = ((coachData.preferences as Record<string, unknown>) ?? {});
    const sentAt: Record<string, string> = { ...((coachPrefs.planNotifSentAt as Record<string, string>) ?? {}) };
    const now = new Date().toISOString();
    clientIds.forEach((id) => { sentAt[id] = now; });
    await admin.from("app_state").upsert({
      user_id: coachId,
      data: { ...coachData, preferences: { ...coachPrefs, planNotifSentAt: sentAt } },
      updated_at: now,
    });
  }

  // ── Cas 1 : un sportif spécifique ──────────────────────────────────────────
  if (targetUserId) {
    // Vérifier que ce sportif appartient bien à ce coach
    const { data: link } = await admin
      .from("coach_client")
      .select("client_id")
      .eq("coach_id", user.id)
      .eq("client_id", targetUserId)
      .maybeSingle();

    if (!link) {
      return NextResponse.json({ error: "Ce sportif n'est pas dans votre liste" }, { status: 403 });
    }

    const prefs = await getUserNotifPrefs(targetUserId);
    if (prefs.newPlan) await sendPushToUser(targetUserId, NOTIF_PAYLOAD);
    await Promise.all([
      appendPlanUpdateToChat(admin, targetUserId, user.id, coachName),
      updateCoachPlanNotif([targetUserId]),
    ]);
    return NextResponse.json({ sent: 1 });
  }

  // ── Cas 2 : tous les sportifs du coach (legacy / vue propre profil) ─────────
  const { data: links } = await admin
    .from("coach_client")
    .select("client_id")
    .eq("coach_id", user.id);

  if (!links?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  await Promise.allSettled(
    links.map(async ({ client_id }) => {
      const prefs = await getUserNotifPrefs(client_id);
      if (prefs.newPlan) { await sendPushToUser(client_id, NOTIF_PAYLOAD); sent++; }
      await appendPlanUpdateToChat(admin, client_id, user.id, coachName);
    })
  );
  await updateCoachPlanNotif(links.map((l) => l.client_id));

  return NextResponse.json({ sent });
}
