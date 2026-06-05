import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Vérifie que l'appelant est bien un coach authentifié. */
async function requireCoach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "coach") return null;
  return user;
}

/**
 * GET /api/coach/athletes
 * Retourne pour chaque sportif (role=client) :
 *   id, name, email, status, last_sign_in_at, updated_by_coach_at, updated_by_client_at
 */
export async function GET() {
  const coach = await requireCoach();
  if (!coach) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const supabase = await createClient();

  // 1. Profils des sportifs
  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id,name,email,status")
    .eq("role", "client")
    .order("created_at");

  if (profilesErr) return NextResponse.json({ error: profilesErr.message }, { status: 500 });

  const athleteIds = (profiles ?? []).map((p) => p.id);
  if (athleteIds.length === 0) return NextResponse.json([]);

  // 2. Timestamps de modification (app_state)
  const { data: states } = await supabase
    .from("app_state")
    .select("user_id,updated_by_coach_at,updated_by_client_at")
    .in("user_id", athleteIds);

  // 3. Dernière connexion via admin API (auth.users)
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const authMap: Record<string, string | null> = {};
  for (const u of authList?.users ?? []) {
    authMap[u.id] = u.last_sign_in_at ?? null;
  }

  // 4. Fusion
  const result = (profiles ?? []).map((p) => {
    const s = states?.find((x) => x.user_id === p.id);
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      status: p.status ?? "active",
      last_sign_in_at: authMap[p.id] ?? null,
      updated_by_coach_at: s?.updated_by_coach_at ?? null,
      updated_by_client_at: s?.updated_by_client_at ?? null,
    };
  });

  return NextResponse.json(result);
}
