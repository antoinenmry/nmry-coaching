import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireElevated() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "coach" && profile?.role !== "admin") return null;
  return user;
}

/**
 * GET /api/coach/unassigned
 * Retourne les clients sans coach affecté.
 */
export async function GET() {
  const user = await requireElevated();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createAdminClient();
  const { data: assigned } = await adminClient
    .from("coach_client").select("client_id");
  const assignedIds = (assigned ?? []).map((r: { client_id: string }) => r.client_id);

  const query = adminClient
    .from("profiles")
    .select("id,name,email,role,status")
    .eq("role", "client")
    .order("created_at");

  const { data: clients } = assignedIds.length > 0
    ? await query.not("id", "in", `(${assignedIds.join(",")})`)
    : await query;

  return NextResponse.json(clients ?? []);
}
