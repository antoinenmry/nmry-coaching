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

  // Si pas de recipientId direct, chercher le destinataire naturel
  if (!targetId && clientId) {
    // Vérifier que clientId correspond bien à l'utilisateur connecté
    if (clientId !== user.id) {
      return NextResponse.json({ skipped: true, reason: "client_mismatch" });
    }
    // Client → chercher son coach dans coach_client
    const { data: link } = await admin
      .from("coach_client")
      .select("coach_id")
      .eq("client_id", user.id)
      .maybeSingle();
    targetId = link?.coach_id ?? null;

    // Pas de coach lié → fallback : notifier tous les admins
    // (cas où l'app est gérée par un admin sans lien coach_client explicite)
    if (!targetId) {
      const { data: admins } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "admin");

      if (!admins?.length) return NextResponse.json({ skipped: true, reason: "no_recipient" });

      const body = isVoice
        ? "🎤 Message vocal"
        : messageText?.slice(0, 100) ?? "Nouveau message";

      await Promise.allSettled(
        admins
          .filter((a) => a.id !== user.id)
          .map(async ({ id }) => {
            const prefs = await getUserNotifPrefs(id);
            if (!prefs.newMessage) return;
            return sendPushToUser(id, {
              title: `💬 ${senderName || "Message"}`,
              body,
              url: "/followup",
            });
          })
      );
      return NextResponse.json({ sent: true });
    }
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
