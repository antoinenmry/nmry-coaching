import { NextResponse } from "next/server";
import { mediaSrc } from "@/lib/media";
import { SITE_URL } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rateLimit";

/**
 * GET /api/me/export
 * Droit d'accès et à la portabilité (RGPD art. 15 et 20) : toutes les données du compte connecté,
 * en JSON. Reste disponible pour un sportif en pause.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`export:${user.id}`, 5, 60 * 60_000).ok) {
    return NextResponse.json({ error: "Trop de demandes, réessaie dans une heure." }, { status: 429 });
  }

  const admin = createAdminClient();
  const [{ data: profile }, { data: state }, { data: messages }] = await Promise.all([
    admin.from("profiles").select("id, email, name, role, status, vacation_start, vacation_end, created_at").eq("id", user.id).maybeSingle(),
    admin.from("app_state").select("data, updated_at").eq("user_id", user.id).maybeSingle(),
    admin
      .from("chat_messages")
      .select("created_at, sender_id, sender_name, body, is_voice, is_urgent, type, attachment_url, attachment_type, attachment_path, edited_at")
      .or(`client_id.eq.${user.id},sender_id.eq.${user.id}`)
      .order("created_at", { ascending: true }),
  ]);

  const exported = {
    exportedAt: new Date().toISOString(),
    account: { email: user.email, createdAt: user.created_at, lastSignInAt: user.last_sign_in_at, metadata: user.user_metadata },
    profile,
    appData: state?.data ?? null,
    // Pièces jointes : lien vers le relais (ouvrable une fois connecté), pas d'URL de stockage brute.
    messages: (messages ?? []).map(({ attachment_path, attachment_url, ...m }) => {
      const src = mediaSrc(attachment_url, attachment_path);
      return { ...m, attachment: src && !src.startsWith("data:") ? `${SITE_URL}${src}` : null };
    }),
  };

  return new NextResponse(JSON.stringify(exported, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="nmry-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
