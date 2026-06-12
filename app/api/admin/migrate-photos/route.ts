import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";

// Route one-shot : migre les photos de profil base64 → Supabase Storage.
// Appelez GET /api/admin/migrate-photos une seule fois en étant connecté en coach/admin.
// Idempotent : ignore les photos déjà converties en URL https://.

export async function GET() {
  const auth = await requireRole(["coach", "admin"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  // 1. Lire tous les profils
  const { data: rows, error } = await supabase
    .from("app_state")
    .select("user_id, data");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { userId: string; status: "migrated" | "skipped" | "error"; detail?: string }[] = [];

  for (const row of rows ?? []) {
    const userId: string = row.user_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = row.data;
    const photo: string = data?.profile?.photo ?? "";

    // Déjà une URL https → rien à faire
    if (!photo || photo.startsWith("http")) {
      results.push({ userId, status: "skipped" });
      continue;
    }

    // Doit être un data URL base64 du type data:image/<ext>;base64,<payload>
    const commaIdx = photo.indexOf(",");
    const header = commaIdx > 0 ? photo.slice(0, commaIdx) : "";
    const mimeMatch = header.match(/^data:(image\/[a-z+]+);base64$/);
    const match = mimeMatch ? [null, mimeMatch[1], photo.slice(commaIdx + 1)] : null;
    if (!match) {
      results.push({ userId, status: "skipped", detail: "not a base64 data URL" });
      continue;
    }

    const mimeType = match[1]!; // ex: "image/jpeg" ou "image/png"
    const base64Payload = match[2]!;
    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";

    try {
      const buffer = Buffer.from(base64Payload, "base64");
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, buffer, {
          contentType: mimeType,
          upsert: true,
          cacheControl: "31536000",
        });

      if (uploadError) {
        results.push({ userId, status: "error", detail: uploadError.message });
        continue;
      }

      const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;

      // Patch uniquement le champ photo dans le JSONB (jsonb_set côté SQL ou via update client)
      const newData = { ...data, profile: { ...data.profile, photo: publicUrl } };
      const { error: updateError } = await supabase
        .from("app_state")
        .update({ data: newData })
        .eq("user_id", userId);

      if (updateError) {
        results.push({ userId, status: "error", detail: updateError.message });
        continue;
      }

      results.push({ userId, status: "migrated" });
    } catch (e) {
      results.push({ userId, status: "error", detail: String(e) });
    }
  }

  const migrated = results.filter((r) => r.status === "migrated").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error");

  return NextResponse.json({
    summary: { migrated, skipped, errors: errors.length },
    errors,
    all: results,
  });
}
