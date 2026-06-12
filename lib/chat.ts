import { createAdminClient } from "@/lib/supabase/admin";
import type { ChatMessage } from "@/lib/types";

type Admin = ReturnType<typeof createAdminClient>;

/** Ligne brute de la table chat_messages. */
export interface ChatRow {
  id: string;
  coach_id: string;
  client_id: string;
  sender_id: string;
  sender_name: string | null;
  body: string;
  audio_url: string | null;
  is_voice: boolean;
  is_urgent: boolean;
  type: string | null;
  is_read: boolean;
  created_at: string;
  edited_at: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_path: string | null;
  audio_path: string | null;
}

/** Convertit une ligne SQL en ChatMessage (forme utilisée par le front). */
export function rowToMessage(r: ChatRow): ChatMessage {
  return {
    id: r.id,
    text: r.body,
    isUrgent: r.is_urgent,
    isVoice: r.is_voice,
    audioUrl: r.audio_url ?? undefined,
    createdAt: r.created_at,
    editedAt: r.edited_at ?? undefined,
    senderId: r.sender_id,
    senderName: r.sender_name ?? undefined,
    isRead: r.is_read,
    type: (r.type as ChatMessage["type"]) ?? undefined,
    attachmentUrl: r.attachment_url ?? undefined,
    attachmentType: (r.attachment_type as ChatMessage["attachmentType"]) ?? undefined,
    attachmentPath: r.attachment_path ?? undefined,
    audioPath: r.audio_path ?? undefined,
  };
}

export interface InsertChatArgs {
  coachId: string;
  clientId: string;
  senderId: string;
  senderName?: string;
  text?: string;
  audioUrl?: string;
  isVoice?: boolean;
  isUrgent?: boolean;
  type?: "broadcast" | "plan_update" | null;
  attachmentUrl?: string;
  attachmentType?: "image" | "video";
  attachmentPath?: string;
  audioPath?: string;
}

/** Insère un message dans la conversation (coach_id, client_id). */
export async function insertChatMessage(admin: Admin, args: InsertChatArgs): Promise<ChatRow | null> {
  const { data, error } = await admin
    .from("chat_messages")
    .insert({
      coach_id: args.coachId,
      client_id: args.clientId,
      sender_id: args.senderId,
      sender_name: args.senderName ?? null,
      body: args.text ?? "",
      audio_url: args.audioUrl ?? null,
      is_voice: args.isVoice ?? false,
      is_urgent: args.isUrgent ?? false,
      type: args.type ?? null,
      is_read: false,
      attachment_url: args.attachmentUrl ?? null,
      attachment_type: args.attachmentType ?? null,
      attachment_path: args.attachmentPath ?? null,
      audio_path: args.audioPath ?? null,
    })
    .select()
    .single();
  if (error) {
    console.error("[chat] insert error:", error);
    return null;
  }
  return data as ChatRow;
}

/** Renvoie le coach affecté à un client (via coach_client). null si aucun. */
export async function getCoachOf(admin: Admin, clientId: string): Promise<string | null> {
  const { data } = await admin
    .from("coach_client")
    .select("coach_id")
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as { coach_id: string } | null)?.coach_id ?? null;
}
