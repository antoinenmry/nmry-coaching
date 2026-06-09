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

  const scopeCol = role === "coach" || role === "admin" ? "coach_id" : "client_id";

  // Deux compteurs : total non-lus + sous-ensemble urgent (pour le bandeau coach).
  const baseFilter = () =>
    admin
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false)
      .neq("sender_id", user.id)
      .eq(scopeCol, user.id);

  const [{ count }, { count: urgent }] = await Promise.all([
    baseFilter(),
    baseFilter().eq("is_urgent", true),
  ]);

  return NextResponse.json({ count: count ?? 0, urgent: urgent ?? 0 });
}
