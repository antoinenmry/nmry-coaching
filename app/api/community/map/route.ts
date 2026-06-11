import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/community/map
 * Renvoie les membres ayant accepté d'apparaître sur la carte communauté.
 *
 * ⚠️ Confidentialité : on ne renvoie QUE les membres `mapConsent === true`,
 * avec UNIQUEMENT prénom + ville + coordonnées ARRONDIES (centre-ville).
 * Les coordonnées précises ne quittent jamais le serveur.
 *
 * Masqué aux sportifs pour l'instant : réservé coach/admin (requireRole).
 */

// Arrondi ~ville (1 décimale ≈ 11 km) → impossible de remonter au quartier/à la rue.
const round1 = (n: number) => Math.round(n * 10) / 10;

interface MapMember {
  firstName: string;
  city: string;
  lat: number;
  lng: number;
  sports: string[];
}

export async function GET() {
  const auth = await requireRole(["coach", "admin"]);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  // On ne sélectionne que les sous-champs utiles (jamais la photo base64).
  const { data, error } = await admin
    .from("app_state")
    .select(
      "name:data->profile->>name, consent:data->profile->mapConsent, location:data->profile->location, sports:data->profile->sports",
    );

  if (error) {
    console.error("[community/map] select error:", error);
    return NextResponse.json({ error: "Erreur de chargement" }, { status: 500 });
  }

  type Row = {
    name: string | null;
    consent: boolean | null;
    location: { label?: string; lat?: number; lng?: number } | null;
    sports: string[] | null;
  };

  const members: MapMember[] = ((data as Row[] | null) ?? [])
    .filter((r) => r.consent === true && r.location?.lat != null && r.location?.lng != null)
    .map((r) => {
      const firstName = (r.name ?? "").trim().split(/\s+/)[0] || "Membre";
      const city = (r.location?.label ?? "").split(",")[0].trim() || "—";
      return {
        firstName,
        city,
        lat: round1(r.location!.lat!),
        lng: round1(r.location!.lng!),
        sports: Array.isArray(r.sports) ? r.sports : [],
      };
    });

  return NextResponse.json({ members });
}
