import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const BUCKET = "chat-attachments";
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * POST /api/chat/upload
 * FormData: { file: File, clientId: string }
 * Returns: { url, path, type: "image" | "video" }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "FormData invalide" }, { status: 400 });

  const file = form.get("file") as File | null;
  const clientId = (form.get("clientId") as string | null)?.trim();
  if (!file || !clientId) return NextResponse.json({ error: "file et clientId requis" }, { status: 400 });

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop lourd (max 50 MB)" }, { status: 413 });
  }

  const mime = file.type;
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "Type non supporté (image ou vidéo uniquement)" }, { status: 415 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? (isImage ? "jpg" : "mp4");
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `chat/${clientId}/${ts}-${rand}.${ext}`;

  const admin = createAdminClient();
  const bytes = await file.arrayBuffer();
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });

  if (uploadErr) {
    console.error("[upload] storage error:", uploadErr);
    return NextResponse.json({ error: "Erreur stockage" }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: publicUrl, path, type: isImage ? "image" : "video" });
}
