import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDefaultCoach } from "@/lib/defaultCoach";

/**
 * GET /api/me/has-coach
 * Retourne { hasCoach: boolean } pour le client connecté.
 * Utilise le client admin pour contourner la RLS de coach_client
 * (qui n'autorise que le coach à lire ses propres lignes).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ hasCoach: false });

  // Les coaches et admins ont toujours "accès" (pas de coach requis)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "coach" || profile?.role === "admin") {
    return NextResponse.json({ hasCoach: true });
  }

  // Pour un client : vérifier via le client admin (bypass RLS)
  const admin = createAdminClient();
  const { data: link } = await admin
    .from("coach_client")
    .select("coach_id")
    .eq("client_id", user.id)
    .maybeSingle();
  if (link?.coach_id) return NextResponse.json({ hasCoach: true });

  // Filet de sécurité : si /api/auth/on-signup n'a pas pu s'exécuter (onglet
  // fermé, confirmation d'email sur un autre appareil…), on affecte le coach
  // par défaut aux comptes créés il y a moins de 7 jours. Au-delà, une
  // désaffectation faite par l'admin reste respectée.
  const assigned = await ensureDefaultCoach(admin, user.id, { maxAgeMs: 7 * 24 * 3600 * 1000 });
  return NextResponse.json({ hasCoach: !!assigned });
}
