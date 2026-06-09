import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/chat/audio?id=<messageId>
 * Renvoie l'audio (data URL base64) d'UN message vocal, à la demande (au play).
 * Permet d'exclure les vocaux du payload de la liste → chat beaucoup plus léger.
 *
 * Autorisation : le sportif de la conversation, son coach, ou un admin.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("chat_messages")
    .select("client_id, coach_id, audio_url")
    .eq("id", id)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Le sportif de la conversation ou son coach affecté ; sinon admin uniquement.
  let allowed = row.client_id === user.id || row.coach_id === user.id;
  if (!allowed) {
    const { data: me } = await admin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    allowed = (me as { role?: string } | null)?.role === "admin";
  }
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ audioUrl: row.audio_url ?? null });
}
