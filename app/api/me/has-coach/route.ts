import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  return NextResponse.json({ hasCoach: !!link?.coach_id });
}
