import { mediaSrc } from "@/lib/media";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChatMessage, ChatReplyPreview } from "@/lib/types";

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
  reaction: string | null;
  reply_to?: string | null;
}

/** Convertit une ligne SQL en ChatMessage (forme utilisée par le front). */
export function rowToMessage(r: ChatRow): ChatMessage {
  return {
    id: r.id,
    text: r.body,
    isUrgent: r.is_urgent,
    isVoice: r.is_voice,
    audioUrl: mediaSrc(r.audio_url, r.audio_path),
    createdAt: r.created_at,
    editedAt: r.edited_at ?? undefined,
    senderId: r.sender_id,
    senderName: r.sender_name ?? undefined,
    isRead: r.is_read,
    type: (r.type as ChatMessage["type"]) ?? undefined,
    attachmentUrl: mediaSrc(r.attachment_url, r.attachment_path),
    attachmentType: (r.attachment_type as ChatMessage["attachmentType"]) ?? undefined,
    attachmentPath: r.attachment_path ?? undefined,
    audioPath: r.audio_path ?? undefined,
    reaction: r.reaction ?? undefined,
    replyToId: r.reply_to ?? undefined,
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
  replyTo?: string;
}

/** Insère un message dans la conversation (coach_id, client_id). */
export async function insertChatMessage(admin: Admin, args: InsertChatArgs): Promise<ChatRow | null> {
  const res = await insertOnce(admin, args);
  // Colonne reply_to absente (chat-replies.sql pas encore lancé) : on envoie sans la citation.
  if (res === "missing-column" && args.replyTo) return (await insertOnce(admin, { ...args, replyTo: undefined })) as ChatRow | null;
  return res === "missing-column" ? null : res;
}

async function insertOnce(admin: Admin, args: InsertChatArgs): Promise<ChatRow | null | "missing-column"> {
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
      // Colonne ajoutée par chat-replies.sql : envoyée seulement pour une réponse.
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
    })
    .select()
    .single();
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") return "missing-column";
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

type PreviewRow = {
  id: string; sender_id: string; sender_name: string | null; body: string | null; is_voice: boolean;
  attachment_type: string | null; attachment_path: string | null; attachment_url: string | null; created_at: string;
};

/** Aperçus des messages cités (réponses), limités à la conversation `clientId`. */
export async function loadReplyPreviews(admin: Admin, clientId: string, ids: string[]): Promise<Map<string, ChatReplyPreview>> {
  const out = new Map<string, ChatReplyPreview>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return out;
  const { data } = await admin
    .from("chat_messages")
    .select("id,sender_id,sender_name,body,is_voice,attachment_type,attachment_path,attachment_url,created_at")
    .eq("client_id", clientId)
    .in("id", unique);
  for (const r of (data as PreviewRow[] | null) ?? []) {
    const kind = r.is_voice ? "voice" : r.attachment_type === "video" ? "video" : r.attachment_type === "image" ? "image" : "text";
    out.set(r.id, {
      id: r.id,
      senderId: r.sender_id,
      senderName: r.sender_name ?? undefined,
      text: (r.body ?? "").slice(0, 140),
      kind,
      mediaUrl: kind === "image" || kind === "video" ? mediaSrc(r.attachment_url, r.attachment_path) : undefined,
      createdAt: r.created_at,
    });
  }
  return out;
}
