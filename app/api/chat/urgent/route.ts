import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/apiAuth";

/**
 * GET /api/chat/urgent
 * Messages urgents NON LUS reçus par le coach/admin connecté, toutes conversations
 * confondues (20 plus récents). Sert la section « Messages urgents » de /overview :
 * chaque ligne renvoie vers la conversation, sur le message concerné.
 */
export async function GET() {
  const caller = await requireRole(["coach", "admin"]);
  if (!caller) return NextResponse.json({ messages: [] }, { status: 401 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ messages: [] }, { status: 401 });

  const admin = createAdminClient();
  let query = admin
    .from("chat_messages")
    .select("id, client_id, sender_id, sender_name, body, is_voice, created_at")
    .eq("is_urgent", true)
    .eq("is_read", false)
    .neq("sender_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Le coach ne voit que ses conversations ; l'admin les voit toutes.
  if (caller.role === "coach") query = query.eq("coach_id", user.id);

  const { data: rows, error } = await query;
  if (error) {
    console.error("[chat/urgent] select error:", error);
    return NextResponse.json({ error: "Erreur de chargement" }, { status: 500 });
  }

  type Row = {
    id: string; client_id: string; sender_id: string; sender_name: string | null;
    body: string; is_voice: boolean; created_at: string;
  };
  const list = (rows as Row[] | null) ?? [];

  // Noms des sportifs en une seule requête.
  const ids = Array.from(new Set(list.map((r) => r.client_id)));
  const { data: profs } = ids.length
    ? await admin.from("profiles").select("id, name, email").in("id", ids)
    : { data: null };
  const nameOf = new Map(
    ((profs as { id: string; name?: string; email?: string }[] | null) ?? []).map((p) => [p.id, p.name || p.email || ""]),
  );

  return NextResponse.json({
    messages: list.map((r) => ({
      id: r.id,
      clientId: r.client_id,
      clientName: nameOf.get(r.client_id) || r.sender_name || "Sportif",
      text: r.is_voice ? "Message vocal" : r.body,
      isVoice: r.is_voice,
      createdAt: r.created_at,
    })),
  });
}
