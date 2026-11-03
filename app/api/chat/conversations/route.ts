import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/apiAuth";

/** Longueur max de l'aperçu du dernier message (le reste est inutile dans la liste). */
const PREVIEW_LENGTH = 120;

/**
 * GET /api/chat/conversations
 * Liste des conversations du coach/admin : dernier message, non-lus et urgences par sportif.
 * ⚡ Une requête `limit 1` par sportif (index client_id + created_at), sans audio ni pièce jointe.
 */
export async function GET() {
  const auth = await requireRole(["coach", "admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const scope = auth.role === "coach"
    ? await admin.from("coach_client").select("client_id").eq("coach_id", auth.user.id)
    : await admin.from("profiles").select("client_id:id").eq("role", "client");
  const clientIds = ((scope.data as { client_id: string }[] | null) ?? []).map(r => r.client_id);
  if (clientIds.length === 0) return NextResponse.json({ conversations: [] });

  const [lastRows, { data: unreadRows }, { data: states }] = await Promise.all([
    Promise.all(
      clientIds.map(id =>
        admin
          .from("chat_messages")
          .select("sender_id,body,is_voice,type,attachment_type,created_at")
          .eq("client_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ),
    ),
    // Mêmes règles que /api/chat/unread : messages reçus par l'appelant.
    admin
      .from("chat_messages")
      .select("client_id,is_urgent")
      .eq("coach_id", auth.user.id)
      .eq("is_read", false)
      .neq("sender_id", auth.user.id),
    admin.from("app_state").select("user_id, photo:data->profile->>photo").in("user_id", clientIds),
  ]);

  const unread = new Map<string, { count: number; urgent: number }>();
  for (const r of (unreadRows as { client_id: string; is_urgent: boolean }[] | null) ?? []) {
    const c = unread.get(r.client_id) ?? { count: 0, urgent: 0 };
    c.count += 1;
    if (r.is_urgent) c.urgent += 1;
    unread.set(r.client_id, c);
  }

  // Seules les URL Storage passent : une ancienne photo base64 alourdirait la liste.
  const photos = new Map(
    ((states as { user_id: string; photo: string | null }[] | null) ?? [])
      .filter(s => s.photo?.startsWith("http"))
      .map(s => [s.user_id, s.photo as string]),
  );

  const conversations = clientIds.map((clientId, i) => {
    const last = lastRows[i].data as {
      sender_id: string;
      body: string | null;
      is_voice: boolean;
      type: string | null;
      attachment_type: string | null;
      created_at: string;
    } | null;
    const counts = unread.get(clientId);
    return {
      clientId,
      photo: photos.get(clientId),
      unread: counts?.count ?? 0,
      urgent: counts?.urgent ?? 0,
      last: last && {
        text: (last.body ?? "").slice(0, PREVIEW_LENGTH),
        isMine: last.sender_id === auth.user.id,
        isVoice: last.is_voice,
        type: last.type,
        attachmentType: last.attachment_type,
        createdAt: last.created_at,
      },
    };
  });

  return NextResponse.json({ conversations });
}
