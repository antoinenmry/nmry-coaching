import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/chat/unread
 * Nombre de messages non lus pour l'appelant en tant que destinataire.
 * - Sportif : messages reçus du coach non lus.
 * - Coach/admin : messages reçus de SES sportifs non lus (toutes conversations).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (me as { role?: string } | null)?.role ?? "client";

  let query = admin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false)
    .neq("sender_id", user.id);

  if (role === "coach" || role === "admin") {
    query = query.eq("coach_id", user.id);
  } else {
    query = query.eq("client_id", user.id);
  }

  const { count } = await query;
  return NextResponse.json({ count: count ?? 0 });
}
