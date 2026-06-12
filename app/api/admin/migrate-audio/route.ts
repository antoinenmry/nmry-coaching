import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";

// Route one-shot : migre les vocaux base64 (audio_url) → Supabase Storage.
// Appelez GET /api/admin/migrate-audio une seule fois en étant connecté en coach/admin.
// Idempotent : ignore les messages dont audio_url est déjà une URL https://.

export async function GET() {
  const auth = await requireRole(["coach", "admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // Lire tous les messages vocaux avec un audio_url base64
  const { data: rows, error } = await supabase
    .from("chat_messages")
    .select("id, audio_url")
    .eq("is_voice", true)
    .not("audio_url", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { id: string; status: "migrated" | "skipped" | "error"; detail?: string }[] = [];

  for (const row of rows ?? []) {
    const audioUrl: string = row.audio_url ?? "";

    // Déjà une URL https → rien à faire
    if (!audioUrl || audioUrl.startsWith("http")) {
      results.push({ id: row.id, status: "skipped" });
      continue;
    }

    // Doit être un data URL base64 : data:audio/<ext>;base64,<payload>
    const commaIdx = audioUrl.indexOf(",");
    const header = commaIdx > 0 ? audioUrl.slice(0, commaIdx) : "";
    const mimeMatch = header.match(/^data:(audio\/[a-z0-9+.-]+);base64$/);
    if (!mimeMatch) {
      results.push({ id: row.id, status: "skipped", detail: "not a base64 data URL" });
      continue;
    }

    const mimeType = mimeMatch[1]!;
    const base64Payload = audioUrl.slice(commaIdx + 1);
    const ext = mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : "webm";

    try {
      const buffer = Buffer.from(base64Payload, "base64");
      const path = `audio-migration/${row.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(path, buffer, { contentType: mimeType, upsert: true, cacheControl: "31536000" });

      if (uploadError) {
        results.push({ id: row.id, status: "error", detail: uploadError.message });
        continue;
      }

      const publicUrl = supabase.storage.from("chat-attachments").getPublicUrl(path).data.publicUrl;

      const { error: updateError } = await supabase
        .from("chat_messages")
        .update({ audio_url: publicUrl, audio_path: path })
        .eq("id", row.id);

      if (updateError) {
        results.push({ id: row.id, status: "error", detail: updateError.message });
        continue;
      }

      results.push({ id: row.id, status: "migrated" });
    } catch (e) {
      results.push({ id: row.id, status: "error", detail: String(e) });
    }
  }

  const migrated = results.filter((r) => r.status === "migrated").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error");

  return NextResponse.json({
    summary: { migrated, skipped, errors: errors.length },
    errors,
  });
}
