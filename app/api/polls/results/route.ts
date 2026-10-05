import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/apiAuth";
import { groupIdsFor } from "@/lib/groupIds";

/**
 * GET /api/polls/results?id=<announcementId>
 * Résultats d'un sondage (coach / admin) : réponses de ses sportifs, avec les noms.
 * Chaque vote est stocké dans l'état du votant (AppState.pollVotes).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const caller = await requireRole(["coach", "admin"]);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "id invalide" }, { status: 400 });

  const admin = createAdminClient();
  const { clientIds } = await groupIdsFor(admin, caller.user.id, caller.role);
  if (clientIds.length === 0) return NextResponse.json({ votes: [], total: 0 });

  const [{ data: rows }, { data: profs }] = await Promise.all([
    admin.from("app_state").select(`user_id, vote:data->pollVotes->>${id}`).in("user_id", clientIds),
    admin.from("profiles").select("id, name, email").in("id", clientIds),
  ]);
  const nameOf = new Map(((profs as { id: string; name?: string; email?: string }[] | null) ?? []).map((p) => [p.id, p.name || p.email || ""]));
  const votes = ((rows as { user_id: string; vote: string | null }[] | null) ?? [])
    .filter((r) => r.vote)
    .map((r) => ({ name: nameOf.get(r.user_id) ?? "", option: r.vote as string }));
  return NextResponse.json({ votes, total: clientIds.length });
}
