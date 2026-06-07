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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recipientId, clientId, senderName, messageText, isVoice } = await req.json().catch(() => ({}));

  // Valider recipientId si fourni (évite l'injection dans le filtre PostgREST)
  if (recipientId && !UUID_RE.test(recipientId)) {
    return NextResponse.json({ skipped: true, reason: "invalid_recipient" });
  }

  const admin = createAdminClient();

  // Récupérer le profil de l'expéditeur (role nécessaire pour adapter la logique)
  const { data: senderProfile } = await admin
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  const senderRole = senderProfile?.role ?? "client";
  const isAdmin = senderRole === "admin";

  let targetId: string | null = recipientId ?? null;

  // Si pas de recipientId direct (= un sportif écrit), on notifie son coach lié
  // ET tous les admins. Garantit la réception côté staff quel que soit l'état
  // des liens coach_client (cas app gérée par un admin sans lien explicite, ou
  // sportif rattaché à un coach différent).
  if (!targetId && clientId) {
    // Vérifier que clientId correspond bien à l'utilisateur connecté
    if (clientId !== user.id) {
      return NextResponse.json({ skipped: true, reason: "client_mismatch" });
    }

    const recipients = new Set<string>();

    // 1. Coach lié dans coach_client (s'il existe)
    const { data: link } = await admin
      .from("coach_client")
      .select("coach_id")
      .eq("client_id", user.id)
      .maybeSingle();
    if (link?.coach_id) recipients.add(link.coach_id);

    // 2. Tous les admins (référents par défaut)
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    admins?.forEach((a) => recipients.add(a.id));

    recipients.delete(user.id); // jamais se notifier soi-même

    if (recipients.size === 0) {
      return NextResponse.json({ skipped: true, reason: "no_recipient" });
    }

    const body = isVoice
      ? "🎤 Message vocal"
      : messageText?.slice(0, 100) ?? "Nouveau message";

    const results = await Promise.allSettled(
      [...recipients].map(async (id) => {
        const prefs = await getUserNotifPrefs(id);
        if (!prefs.newMessage) return { id, skipped: "pref_disabled" };
        await sendPushToUser(id, {
          title: `💬 ${senderName || "Message"}`,
          body,
          url: "/followup",
        });
        return { id, ok: true };
      })
    );

    const notified = results.filter(
      (r) => r.status === "fulfilled" && (r.value as { ok?: boolean }).ok
    ).length;

    return NextResponse.json({ sent: true, recipients: recipients.size, notified });
  }

  if (!targetId) return NextResponse.json({ skipped: true, reason: "no_recipient" });
  if (targetId === user.id) return NextResponse.json({ skipped: true });

  // Un admin peut écrire à n'importe qui (il voit tous les sportifs sans lien
  // coach_client). On bypass la vérif de lien pour lui.
  if (!isAdmin) {
    // Vérifier que l'expéditeur est bien lié au destinataire dans coach_client
    // (deux requêtes simples — évite le .or() imbriqué avec and() qui peut mal
    //  se comporter selon la version PostgREST du projet Supabase)
    const [{ data: linkAsCoach }, { data: linkAsClient }] = await Promise.all([
      // Cas 1 : user = coach, target = client
      admin.from("coach_client").select("id")
        .eq("coach_id", user.id).eq("client_id", targetId).maybeSingle(),
      // Cas 2 : user = client, target = coach
      admin.from("coach_client").select("id")
        .eq("coach_id", targetId).eq("client_id", user.id).maybeSingle(),
    ]);

    if (!linkAsCoach && !linkAsClient) {
      return NextResponse.json({ skipped: true, reason: "not_linked" });
    }
  }

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
