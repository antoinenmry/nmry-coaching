import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { getUserNotifPrefs } from "@/lib/notifPrefs";
import { insertChatMessage, rowToMessage, getCoachOf, type ChatRow } from "@/lib/chat";

/**
 * GET  /api/chat?clientId=…   → messages d'une conversation + participants
 * POST /api/chat              → envoyer un message { clientId?, text?, audioUrl?, isVoice?, isUrgent? }
 *
 * Conversation = couple (coach, sportif). Isolation stricte garantie en base.
 */

// Nombre de messages chargés par page (les plus récents). On remonte au besoin.
const PAGE_SIZE = 15;

/**
 * Résout nom + rôle des participants (client + coach) en 1 requête batchée.
 * ⚡ Les PHOTOS sont volontairement EXCLUES ici : elles sont base64 (parfois
 *    plusieurs Mo pour de vieux uploads) et alourdiraient le payload des
 *    messages. Elles sont chargées séparément via GET /api/chat/avatars,
 *    hors du chemin critique → les messages s'affichent sans les attendre.
 */
async function resolveParticipants(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[],
) {
  const { data: profs } = await admin.from("profiles").select("id, name, role").in("id", ids);
  const profMap = new Map(
    (profs as { id: string; name?: string; role?: string }[] | null ?? []).map(p => [p.id, p]),
  );
  return (id: string) => ({
    id,
    name: profMap.get(id)?.name ?? "",
    role: profMap.get(id)?.role ?? "client",
  });
}

// ─── GET ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const myRole = (me as { role?: string } | null)?.role ?? "client";
  const isElevated = myRole === "coach" || myRole === "admin";

  // Déterminer le client de la conversation
  const paramClient = req.nextUrl.searchParams.get("clientId");
  const clientId = isElevated ? paramClient : user.id;
  if (!clientId) return NextResponse.json({ error: "clientId requis" }, { status: 400 });

  // Autorisation : soit c'est ma propre conversation, soit je suis le coach/admin du client
  if (clientId !== user.id) {
    if (!isElevated) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (myRole === "coach") {
      const { data: link } = await admin
        .from("coach_client").select("client_id")
        .eq("coach_id", user.id).eq("client_id", clientId).maybeSingle();
      if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Curseur de pagination : on charge les messages ANTÉRIEURS à `before` (created_at ISO).
  // Absent → première page (les plus récents).
  const before = req.nextUrl.searchParams.get("before");
  const isFirstPage = !before;

  // Charger une page : les N+1 plus récents (décroissant) pour détecter s'il en reste.
  // ⚡ On EXCLUT audio_url (vocaux base64, lourds) : il est chargé à la demande au play
  //    via GET /api/chat/audio?id=… → payload du chat très allégé.
  let query = admin
    .from("chat_messages")
    .select("id,coach_id,client_id,sender_id,sender_name,body,is_voice,is_urgent,type,is_read,created_at,edited_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (before) query = query.lt("created_at", before);

  // ⚡ Parallélisation : marquage lu (1ère page) + messages + résolution du coach.
  const [, { data: rows }, coachId] = await Promise.all([
    isFirstPage
      ? admin.from("chat_messages").update({ is_read: true })
          .eq("client_id", clientId).neq("sender_id", user.id).eq("is_read", false)
      : Promise.resolve(null),
    query,
    getCoachOf(admin, clientId),
  ]);

  const list = (rows as ChatRow[] | null) ?? [];
  const hasMore = list.length > PAGE_SIZE;
  const page = hasMore ? list.slice(0, PAGE_SIZE) : list;

  // Défense en profondeur : écarter les messages dont l'expéditeur n'est pas
  // un participant légitime (client ou coach de la conversation).
  // Évite d'afficher des bulles parasites héritées d'une migration corrompue.
  const legitimateSenders = new Set([clientId, ...(coachId ? [coachId] : [])]);
  const safeRows = page.filter(r => legitimateSenders.has(r.sender_id));
  // Remettre en ordre chronologique croissant pour l'affichage.
  const messages = safeRows.reverse().map(rowToMessage);

  // Participants (avatars/noms) : utiles seulement à la première page.
  if (!isFirstPage) {
    return NextResponse.json({ messages, hasMore });
  }
  const build = await resolveParticipants(admin, [clientId, ...(coachId ? [coachId] : [])]);
  const client = build(clientId);
  const coach = coachId ? build(coachId) : null;

  return NextResponse.json({ messages, hasMore, participants: { client, coach } });
}

// ─── POST ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role, name").eq("id", user.id).maybeSingle();
  const myRole = (me as { role?: string } | null)?.role ?? "client";
  const myName = (me as { name?: string } | null)?.name || user.email || "Moi";
  const isElevated = myRole === "coach" || myRole === "admin";

  const body = await req.json().catch(() => ({}));
  const text: string = (body?.text ?? "").toString();
  const audioUrl: string | undefined = body?.audioUrl;
  const isVoice = !!body?.isVoice;
  const isUrgent = !!body?.isUrgent;
  if (!text.trim() && !audioUrl) {
    return NextResponse.json({ error: "Message vide" }, { status: 400 });
  }

  // Déterminer le client + coach de la conversation
  let clientId: string;
  if (isElevated) {
    clientId = body?.clientId;
    if (!clientId) return NextResponse.json({ error: "clientId requis" }, { status: 400 });
    if (myRole === "coach") {
      const { data: link } = await admin
        .from("coach_client").select("client_id")
        .eq("coach_id", user.id).eq("client_id", clientId).maybeSingle();
      if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    clientId = user.id;
  }

  // coach_id = coach affecté au client (sinon, si l'envoyeur est élevé, lui-même)
  const assignedCoach = await getCoachOf(admin, clientId);
  const coachId = assignedCoach ?? (isElevated ? user.id : "");
  if (!coachId) {
    return NextResponse.json({ error: "Aucun coach affecté" }, { status: 400 });
  }

  const row = await insertChatMessage(admin, {
    coachId,
    clientId,
    senderId: user.id,
    senderName: myName,
    text: text.trim(),
    audioUrl,
    isVoice,
    isUrgent,
  });
  if (!row) return NextResponse.json({ error: "Erreur d'enregistrement" }, { status: 500 });

  // ── Notifications push ──────────────────────────────────────────────────
  const senderIsClient = user.id === clientId;
  if (senderIsClient) {
    // Sportif → coach. Si urgent, le push (+ email) est géré par /api/messages/urgent
    // appelé côté client → on évite le double push ici.
    if (!isUrgent) {
      sendPushToUser(coachId, {
        title: "💬 Nouveau message",
        body: `${myName} : ${text.trim().slice(0, 80)}`,
        url: "/followup",
      }).catch(() => {});
    }
  } else {
    // Coach → sportif (respecte la préférence du sportif)
    const prefs = await getUserNotifPrefs(clientId);
    if (prefs.newMessage) {
      sendPushToUser(clientId, {
        title: "💬 Message de votre coach",
        body: `${myName} : ${text.trim().slice(0, 80)}`,
        url: "/followup",
      }).catch(() => {});
    }
  }

  return NextResponse.json({ message: rowToMessage(row) });
}
