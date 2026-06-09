import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/apiAuth";
import type { AdminOverview, CoachWithClients, Profile } from "@/lib/types";

/**
 * GET /api/admin/overview
 * Retourne la vue complète : coaches avec leurs clients + clients sans coach.
 */
export async function GET() {
  const caller = await requireRole(["admin"]);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
