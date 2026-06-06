import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireCoach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "coach") return null;
  return user;
}

/**
 * POST /api/coach/self-assign
 * Body: { clientId }
 * Affecte le coach connecté à ce client (si non déjà affecté).
 */
export async function POST(req: NextRequest) {
  const user = await requireCoach();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await req.json();
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const adminClient = createAdminClient();

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
