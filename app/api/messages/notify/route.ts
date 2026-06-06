import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { getUserNotifPrefs } from "@/lib/notifPrefs";

/**
 * POST /api/messages/notify
 * Envoie une notification push pour un nouveau message chat.
 * Vérifie les préférences du destinataire avant d'envoyer.
 *
 * Body: { recipientId: string, senderName: string, messageText?: string, isVoice?: boolean }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recipientId, clientId, senderName, messageText, isVoice } = await req.json();

  const admin = createAdminClient();
  let targetId: string | null = recipientId ?? null;

  // Si pas de recipientId direct, on cherche le coach du client
  if (!targetId && clientId) {
    const { data: link } = await admin
      .from("coach_client")
      .select("coach_id")
      .eq("client_id", clientId)
      .maybeSingle();
    targetId = link?.coach_id ?? null;
  }

  if (!targetId) return NextResponse.json({ skipped: true, reason: "no_recipient" });
  if (targetId === user.id) return NextResponse.json({ skipped: true });

  // Vérifier les préférences du destinataire
  const prefs = await getUserNotifPrefs(targetId);
  if (!prefs.newMessage) return NextResponse.json({ skipped: true, reason: "pref_disabled" });

  const body = isVoice
    ? "🎤 Message vocal"
    : messageText?.slice(0, 100) ?? "Nouveau message";

  await sendPushToUser(targetId, {
    title: `💬 ${senderName || "Message"}`,
    body,
    url: "/followup",
  }).catch(() => {});

  return NextResponse.json({ sent: true });
}
