import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToMessage, type ChatRow } from "@/lib/chat";

/**
 * PATCH /api/chat/:id/reaction   { reaction: string | null }
 * Affecte (ou retire, reaction=null) un emoji de réaction (tapback) sur un message.
 * Contrairement à l'édition du texte, N'IMPORTE QUEL participant de la conversation
 * (sportif, coach affecté, admin) peut réagir — pas seulement l'auteur du message.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: row } = await admin.from("chat_messages").select("*").eq("id", id).maybeSingle();
  const msg = row as ChatRow | null;
  if (!msg) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (me as { role?: string } | null)?.role;
  const isAdmin = role === "admin";
  const isClientOfConv = msg.client_id === user.id;
  let isCoachOfConv = msg.coach_id === user.id;
  if (!isCoachOfConv && role === "coach") {
    const { data: link } = await admin
      .from("coach_client").select("client_id")
      .eq("coach_id", user.id).eq("client_id", msg.client_id).maybeSingle();
    isCoachOfConv = !!link;
  }
  if (!isAdmin && !isClientOfConv && !isCoachOfConv) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const reaction: string | null = body?.reaction ? String(body.reaction).slice(0, 8) : null;

  const { data: updated } = await admin
    .from("chat_messages")
    .update({ reaction })
    .eq("id", id)
    .select()
    .single();

  return NextResponse.json({ message: rowToMessage(updated as ChatRow) });
}
