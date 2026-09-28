import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_COACH_EMAIL } from "@/lib/config";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Affecte automatiquement un nouveau sportif au coach par défaut
 * (`DEFAULT_COACH_EMAIL`, cf. lib/config.ts).
 *
 * - Ne fait rien si le sportif a DÉJÀ un coach → une réaffectation faite par
 *   l'admin (ou par un autre coach) n'est jamais écrasée.
 * - Ne s'applique qu'aux profils `client`.
 * - Filet de sécurité : `maxAgeMs` limite l'auto-affectation aux comptes
 *   récents, pour qu'une désaffectation volontaire de l'admin sur un vieux
 *   compte ne soit pas annulée au prochain chargement.
 *
 * @returns l'id du coach affecté, ou null si rien n'a été fait.
 */
export async function ensureDefaultCoach(
  admin: Admin,
  clientId: string,
  opts: { maxAgeMs?: number } = {},
): Promise<string | null> {
  if (!DEFAULT_COACH_EMAIL) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("role, created_at")
    .eq("id", clientId)
    .maybeSingle();
  const p = profile as { role?: string; created_at?: string } | null;
  if (!p || p.role !== "client") return null;

  if (opts.maxAgeMs !== undefined) {
    const created = new Date(p.created_at ?? 0).getTime();
    if (!created || Date.now() - created > opts.maxAgeMs) return null;
  }

  const { data: existing } = await admin
    .from("coach_client")
    .select("coach_id")
    .eq("client_id", clientId)
    .maybeSingle();
  if ((existing as { coach_id?: string } | null)?.coach_id) return null;

  const { data: coach } = await admin
    .from("profiles")
    .select("id, role")
    .ilike("email", DEFAULT_COACH_EMAIL)
    .maybeSingle();
  const c = coach as { id?: string; role?: string } | null;
  if (!c?.id || (c.role !== "coach" && c.role !== "admin")) {
    console.warn("[defaultCoach] coach par défaut introuvable :", DEFAULT_COACH_EMAIL);
    return null;
  }

  const { error } = await admin
    .from("coach_client")
    .upsert({ coach_id: c.id, client_id: clientId }, { onConflict: "coach_id,client_id" });
  if (error) {
    console.error("[defaultCoach] affectation échouée :", error);
    return null;
  }
  return c.id;
}
