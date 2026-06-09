import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/apiAuth";

/**
 * GET /api/coach/unassigned
 * Retourne les clients sans coach affecté.
 */
export async function GET() {
  const caller = await requireRole(["coach", "admin"]);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
