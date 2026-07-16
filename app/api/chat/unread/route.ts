import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/chat/unread
 * Nombre de messages non lus pour l'appelant en tant que destinataire.
 * - Sportif : messages reçus du coach non lus.
 * - Coach/admin : messages reçus de SES sportifs non lus (toutes conversations),
 *   + répartition par sportif (byClient) pour afficher un badge par personne
 *   sous "Conversation avec :".
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (me as { role?: string } | null)?.role ?? "client";
  const isElevated = role === "coach" || role === "admin";

  const scopeCol = isElevated ? "coach_id" : "client_id";

  // Deux compteurs : total non-lus + sous-ensemble urgent (pour le bandeau coach).
  const baseFilter = () =>
    admin
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false)
      .neq("sender_id", user.id)
      .eq(scopeCol, user.id);

  const [{ count }, { count: urgent }, byClientRows] = await Promise.all([
    baseFilter(),
    baseFilter().eq("is_urgent", true),
    isElevated
      ? admin
          .from("chat_messages")
          .select("client_id")
          .eq("is_read", false)
          .neq("sender_id", user.id)
          .eq(scopeCol, user.id)
      : Promise.resolve({ data: null }),
  ]);

  const byClient: Record<string, number> = {};
  if (isElevated) {
    for (const row of (byClientRows.data as { client_id: string }[] | null) ?? []) {
      byClient[row.client_id] = (byClient[row.client_id] ?? 0) + 1;
    }
  }

  return NextResponse.json({ count: count ?? 0, urgent: urgent ?? 0, byClient });
}
