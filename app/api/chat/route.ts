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

async function profileOf(admin: ReturnType<typeof createAdminClient>, id: string) {
  // On ne sélectionne QUE la photo (chemin JSON) au lieu de tout le blob app_state,
  // qui peut peser plusieurs Mo (programmation, bibliothèque, métriques…).
  const [{ data: prof }, { data: photoRow }] = await Promise.all([
    admin.from("profiles").select("name, role").eq("id", id).maybeSingle(),
    admin.from("app_state").select("photo:data->profile->>photo").eq("user_id", id).maybeSingle(),
  ]);
  const photo = (photoRow as { photo?: string | null } | null)?.photo;
  return {
    id,
    name: (prof as { name?: string } | null)?.name ?? "",
    role: (prof as { role?: string } | null)?.role ?? "client",
    photo: typeof photo === "string" && photo ? photo : undefined,
  };
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

  // Marquer comme lus les messages reçus (uniquement à l'ouverture, pas en remontant)
  if (isFirstPage) {
    await admin
      .from("chat_messages")
      .update({ is_read: true })
      .eq("client_id", clientId)
      .neq("sender_id", user.id)
      .eq("is_read", false);
  }

  // Charger une page : les N+1 plus récents (décroissant) pour détecter s'il en reste.
  let query = admin
    .from("chat_messages")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (before) query = query.lt("created_at", before);

  const { data: rows } = await query;
  const list = (rows as ChatRow[] | null) ?? [];
  const hasMore = list.length > PAGE_SIZE;
  const page = hasMore ? list.slice(0, PAGE_SIZE) : list;
  // Résoudre le coach une seule fois (utile pour le filtre + les participants).
  const coachId = await getCoachOf(admin, clientId);

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
  const [client, coach] = await Promise.all([
    profileOf(admin, clientId),
    coachId ? profileOf(admin, coachId) : Promise.resolve(null),
  ]);

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
