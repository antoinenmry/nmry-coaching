import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return null;
  return user;
}

/**
 * POST /api/admin/assignments
 * Body: { coachId: string; clientId: string }
 * Affecte un client à un coach (remplace l'affectation précédente).
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { coachId, clientId } = await req.json().catch(() => ({}));
  if (!coachId || !clientId) {
    return NextResponse.json({ error: "coachId et clientId requis" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Supprimer l'affectation précédente du client (un client = un coach)
  await adminClient.from("coach_client").delete().eq("client_id", clientId);

  const { error } = await adminClient
    .from("coach_client")
    .insert({ coach_id: coachId, client_id: clientId });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
