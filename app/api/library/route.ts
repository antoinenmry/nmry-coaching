import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/apiAuth";

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
  const { error } = await adminClient
    .from("library_state")
    .upsert({ id: 1, data: body, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) { console.error("[library] upsert error:", error); return NextResponse.json({ error: "Erreur de sauvegarde" }, { status: 500 }); }
  return NextResponse.json({ success: true });
}
