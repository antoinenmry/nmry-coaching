import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/chat/unread
 * Nombre de messages non lus pour l'appelant en tant que destinataire.
 * - Sportif : messages reçus du coach non lus.
 * - Coach/admin : messages reçus de SES sportifs non lus (toutes conversations),
 *   + répartition par sportif (byClient) et `senders` (nom, photo, non-lus, urgences)
 *   pour le repère « Nouveaux messages » par personne dans Mon suivi.
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
          .select("client_id, is_urgent")
          .eq("is_read", false)
          .neq("sender_id", user.id)
          .eq(scopeCol, user.id)
      : Promise.resolve({ data: null }),
  ]);

  const byClient: Record<string, number> = {};
  const urgentByClient: Record<string, number> = {};
  if (isElevated) {
    for (const row of (byClientRows.data as { client_id: string; is_urgent: boolean }[] | null) ?? []) {
      byClient[row.client_id] = (byClient[row.client_id] ?? 0) + 1;
      if (row.is_urgent) urgentByClient[row.client_id] = (urgentByClient[row.client_id] ?? 0) + 1;
    }
  }

  // Qui a écrit : nom et photo de chaque sportif ayant des messages non lus (repère par personne).
  const ids = Object.keys(byClient);
  let senders: { id: string; name: string; photo?: string; count: number; urgent: number }[] = [];
  if (ids.length) {
    const [{ data: profs }, { data: states }] = await Promise.all([
      admin.from("profiles").select("id, name, email").in("id", ids),
      admin.from("app_state").select("user_id, pname:data->profile->>name, photo:data->profile->>photo").in("user_id", ids),
    ]);
    const prof = new Map(((profs as { id: string; name: string | null; email: string | null }[] | null) ?? []).map(p => [p.id, p]));
    const st = new Map(((states as { user_id: string; pname: string | null; photo: string | null }[] | null) ?? []).map(s => [s.user_id, s]));
    senders = ids
      .map(id => ({
        id,
        name: prof.get(id)?.name || st.get(id)?.pname || prof.get(id)?.email || "Sportif",
        // Seules les URL Storage passent : une ancienne photo base64 alourdirait la réponse.
        photo: st.get(id)?.photo?.startsWith("http") ? st.get(id)!.photo! : undefined,
        count: byClient[id],
        urgent: urgentByClient[id] ?? 0,
      }))
      .sort((a, b) => Number(b.urgent > 0) - Number(a.urgent > 0) || b.count - a.count || a.name.localeCompare(b.name, "fr"));
  }

  return NextResponse.json({ count: count ?? 0, urgent: urgent ?? 0, byClient, senders });
}
