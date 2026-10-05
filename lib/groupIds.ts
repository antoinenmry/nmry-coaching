import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Périmètre « groupe » de l'utilisateur :
 *  - sportif → son coach + tous les sportifs de ce coach
 *  - coach   → lui + ses sportifs
 *  - admin   → tout le monde
 */
export async function groupIdsFor(
  admin: Admin,
  userId: string,
  role: string,
): Promise<{ ids: string[]; clientIds: string[] }> {
  if (role === "admin") {
    const { data } = await admin.from("profiles").select("id, role");
    const rows = (data as { id: string; role: string }[] | null) ?? [];
    return { ids: rows.map((r) => r.id), clientIds: rows.filter((r) => r.role === "client").map((r) => r.id) };
  }
  let coachId = userId;
  if (role !== "coach") {
    const { data } = await admin.from("coach_client").select("coach_id").eq("client_id", userId).maybeSingle();
    coachId = (data as { coach_id?: string } | null)?.coach_id ?? "";
    if (!coachId) return { ids: [userId], clientIds: [userId] };
  }
  const { data: links } = await admin.from("coach_client").select("client_id").eq("coach_id", coachId);
  const clientIds = ((links as { client_id: string }[] | null) ?? []).map((l) => l.client_id);
  return { ids: Array.from(new Set([coachId, ...clientIds])), clientIds };
}
