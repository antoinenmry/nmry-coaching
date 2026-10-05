import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/apiAuth";
import { canEditAnnouncements } from "@/lib/config";

/**
 * PUT /api/library
 * Remplace la bibliothèque partagée (library_state id=1).
 * Accessible uniquement aux rôles coach et admin.
 */
export async function PUT(req: NextRequest) {
  const caller = await requireRole(["coach", "admin"]);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  const adminClient = createAdminClient();

  // Annonces d'accueil et liste des sports : seuls les éditeurs désignés (lib/config) peuvent les
  // modifier. On compare avec la version enregistrée : un autre coach qui sauvegarde la
  // bibliothèque renvoie ces champs inchangés, et passe donc sans problème.
  const { data: current } = await adminClient.from("library_state").select("data").eq("id", 1).maybeSingle();
  const cur = (current?.data ?? {}) as Record<string, unknown>;
  const next = body as Record<string, unknown>;
  const norm = (v: unknown) => JSON.stringify(Array.isArray(v) ? v : []);
  for (const key of ["announcements", "sports"] as const) {
    if (norm(cur[key]) !== norm(next[key]) && !canEditAnnouncements(caller.user.email)) {
      return NextResponse.json({ error: "Annonces et sports réservés à Simon et Antoine" }, { status: 403 });
    }
  }

  const { error } = await adminClient
    .from("library_state")
    .upsert({ id: 1, data: body, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) { console.error("[library] upsert error:", error); return NextResponse.json({ error: "Erreur de sauvegarde" }, { status: 500 }); }
  return NextResponse.json({ success: true });
}
