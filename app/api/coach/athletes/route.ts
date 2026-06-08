import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Vérifie que l'appelant est coach ou admin. Retourne { user, role }. */
async function requireElevated() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !["coach", "admin"].includes(profile.role)) return null;
  return { user, role: profile.role as "coach" | "admin" };
}

/**
 * GET /api/coach/athletes
 * Retourne pour chaque sportif (role=client) :
 *   id, name, email, status, vacation_start, vacation_end,
 *   last_sign_in_at, updated_by_coach_at, updated_by_client_at
 */
export async function GET() {
  const caller = await requireElevated();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createAdminClient();
  const supabase = await createClient();

  // 1. Profils des sportifs — admin voit tous les clients, coach voit ses affectés
  let profilesQuery = supabase
    .from("profiles")
    .select("id,name,email,status,vacation_start,vacation_end")
    .eq("role", "client")
    .order("created_at");

  if (caller.role === "coach") {
    // Récupérer les IDs affectés à ce coach
    const { data: assignments } = await supabase
      .from("coach_client")
      .select("client_id")
      .eq("coach_id", caller.user.id);
    const assignedIds = (assignments ?? []).map((a) => a.client_id);
    if (assignedIds.length === 0) return NextResponse.json([]);
    profilesQuery = supabase
      .from("profiles")
      .select("id,name,email,status,vacation_start,vacation_end")
      .eq("role", "client")
      .in("id", assignedIds)
      .order("created_at");
  }

  const { data: profiles, error: profilesErr } = await profilesQuery;
  if (profilesErr) return NextResponse.json({ error: profilesErr.message }, { status: 500 });

  const athleteIds = (profiles ?? []).map((p) => p.id);
  if (athleteIds.length === 0) return NextResponse.json([]);

  // 2. Timestamps (app_state)
  const { data: states } = await supabase
    .from("app_state")
    .select("user_id,updated_by_coach_at,updated_by_client_at")
    .in("user_id", athleteIds);

  // 3. Dernière connexion (auth.users — service role)
  const { data: authList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const authMap: Record<string, string | null> = {};
  for (const u of authList?.users ?? []) authMap[u.id] = u.last_sign_in_at ?? null;

  // 4. Coach affecté pour chaque client (admin uniquement)
  let coachMap: Record<string, string | null> = {};
  if (caller.role === "admin") {
    const { data: allAssignments } = await adminClient
      .from("coach_client")
      .select("coach_id,client_id");
    for (const a of allAssignments ?? []) coachMap[a.client_id] = a.coach_id;
  }

  // 5. Fusion
  const result = (profiles ?? []).map((p) => {
    const s = states?.find((x) => x.user_id === p.id);
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      status: p.status ?? "active",
      vacation_start: p.vacation_start ?? null,
      vacation_end: p.vacation_end ?? null,
      last_sign_in_at: authMap[p.id] ?? null,
      updated_by_coach_at: s?.updated_by_coach_at ?? null,
      updated_by_client_at: s?.updated_by_client_at ?? null,
      coach_id: caller.role === "admin" ? (coachMap[p.id] ?? null) : caller.user.id,
    };
  });

  return NextResponse.json(result);
}
