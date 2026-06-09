import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type Role = "client" | "coach" | "admin";

/**
 * Garde d'authentification + rôle, mutualisée pour les routes API.
 * Retourne { user, role } si l'appelant est connecté ET possède l'un des rôles
 * autorisés, sinon `null` (la route renvoie alors 401).
 *
 * Comportement identique aux anciennes gardes locales (requireAdmin /
 * requireElevated / requireCoach) : lecture du rôle via le client serveur
 * (RLS : profiles_self_select autorise la lecture de sa propre ligne).
 */
export async function requireRole(
  roles: Role[],
): Promise<{ user: User; role: Role } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = ((profile as { role?: string } | null)?.role ?? "client") as Role;
  if (!roles.includes(role)) return null;
  return { user, role };
}
