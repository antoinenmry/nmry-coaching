import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/apiAuth";

/**
 * POST /api/admin/assignments
 * Body: { coachId: string; clientId: string }
 * Affecte un client à un coach (remplace l'affectation précédente).
 */
export async function POST(req: NextRequest) {
  const caller = await requireRole(["admin"]);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { coachId, clientId } = await req.json().catch(() => ({}));
  if (!coachId || !clientId) {
    return NextResponse.json({ error: "coachId et clientId requis" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Vérifier que coachId est bien un coach/admin et clientId un sportif
  const [coachRes, clientRes] = await Promise.all([
    adminClient.from("profiles").select("role").eq("id", coachId).maybeSingle(),
    adminClient.from("profiles").select("role").eq("id", clientId).maybeSingle(),
  ]);
  if (!coachRes.data || !["coach", "admin"].includes(coachRes.data.role)) {
    return NextResponse.json({ error: "coachId invalide" }, { status: 400 });
  }
  if (clientRes.data?.role !== "client") {
    return NextResponse.json({ error: "clientId invalide" }, { status: 400 });
  }

  // Supprimer l'affectation précédente du client (un client = un coach)
  await adminClient.from("coach_client").delete().eq("client_id", clientId);

  const { error } = await adminClient
    .from("coach_client")
    .insert({ coach_id: coachId, client_id: clientId });

  if (error) return NextResponse.json({ error: "Erreur lors de l'affectation" }, { status: 500 });
  return NextResponse.json({ success: true });
}
