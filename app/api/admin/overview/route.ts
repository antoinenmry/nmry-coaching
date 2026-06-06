import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminOverview, CoachWithClients, Profile } from "@/lib/types";

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
 * GET /api/admin/overview
 * Retourne la vue complète : coaches avec leurs clients + clients sans coach.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createAdminClient();

  // Tous les profils
  const { data: allProfiles } = await adminClient
    .from("profiles")
    .select("id,name,email,role,status")
    .order("created_at");

  const profiles = (allProfiles ?? []) as Profile[];

  // Toutes les affectations
  const { data: assignments } = await adminClient
    .from("coach_client")
    .select("coach_id,client_id");

  const assignmentList = assignments ?? [];

  // Construire la map coach → clients
  const coaches = profiles.filter((p) => p.role === "coach" || p.role === "admin");
  const clients = profiles.filter((p) => p.role === "client");

  const assignedClientIds = new Set(assignmentList.map((a) => a.client_id));

  const coachesWithClients: CoachWithClients[] = coaches.map((coach) => {
    const clientIds = assignmentList
      .filter((a) => a.coach_id === coach.id)
      .map((a) => a.client_id);
    return {
      id: coach.id,
      name: coach.name,
      email: coach.email,
      role: coach.role as "coach" | "admin",
      clients: clients.filter((c) => clientIds.includes(c.id)),
    };
  });

  const unassigned = clients.filter((c) => !assignedClientIds.has(c.id));

  const overview: AdminOverview = {
    coaches: coachesWithClients,
    unassigned,
  };

  return NextResponse.json(overview);
}
