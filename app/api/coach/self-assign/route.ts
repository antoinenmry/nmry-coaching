import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/apiAuth";

/**
 * POST /api/coach/self-assign
 * Body: { clientId }
 * Affecte le coach connecté à ce client (si non déjà affecté).
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(["coach"]);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = auth.user;

  const { clientId } = await req.json().catch(() => ({}));
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const adminClient = createAdminClient();

  // Vérifier que clientId correspond bien à un sportif (pas un coach ou admin)
  const { data: clientProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", clientId)
    .maybeSingle();
  if (!clientProfile || clientProfile.role !== "client") {
    return NextResponse.json({ error: "Cet utilisateur n'est pas un sportif" }, { status: 400 });
  }

  // Vérifier que ce client n'est pas déjà affecté à un autre coach
  const { data: existing } = await adminClient
    .from("coach_client")
    .select("coach_id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing && existing.coach_id !== user.id) {
    return NextResponse.json({ error: "Ce sportif est déjà affecté à un autre coach" }, { status: 409 });
  }

  const { error } = await adminClient
    .from("coach_client")
    .upsert({ coach_id: user.id, client_id: clientId });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
