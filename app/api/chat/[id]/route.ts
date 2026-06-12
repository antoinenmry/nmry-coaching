import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToMessage, type ChatRow } from "@/lib/chat";

/**
 * PATCH  /api/chat/:id   { text }   → modifier le texte d'un message (auteur uniquement)
 * DELETE /api/chat/:id              → supprimer un message (auteur uniquement)
 */

async function loadOwn(id: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("chat_messages").select("*").eq("id", id).maybeSingle();
  const row = data as ChatRow | null;
  if (!row) return { admin, row: null, allowed: false };
  const { data: me } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  const role = (me as { role?: string } | null)?.role;
  const isAdmin = role === "admin";
  // Coach peut supprimer tout message de ses propres conversations
  const isCoachOfConv = role === "coach" && row.coach_id === userId;
  return { admin, row, allowed: row.sender_id === userId || isAdmin || isCoachOfConv };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { admin, row, allowed } = await loadOwn(id, user.id);
  if (!row) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const text: string = (body?.text ?? "").toString().trim();
  if (!text) return NextResponse.json({ error: "Texte vide" }, { status: 400 });

  const { data: updated } = await admin
    .from("chat_messages")
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  return NextResponse.json({ message: rowToMessage(updated as ChatRow) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { admin, row, allowed } = await loadOwn(id, user.id);
  if (!row) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Supprime les fichiers Storage associés au message
  const attachPath = (row as { attachment_path?: string | null }).attachment_path;
  if (attachPath) {
    await admin.storage.from("chat-attachments").remove([attachPath]).catch(() => {});
  }
  const audioPath = (row as { audio_path?: string | null }).audio_path;
  if (audioPath) {
    await admin.storage.from("chat-attachments").remove([audioPath]).catch(() => {});
  }
  await admin.from("chat_messages").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
