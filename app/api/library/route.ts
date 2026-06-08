import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireElevated() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["coach", "admin"].includes(profile.role)) return null;
  return user;
}

/**
 * PUT /api/library
 * Remplace la bibliothèque partagée (library_state id=1).
 * Accessible uniquement aux rôles coach et admin.
 */
export async function PUT(req: NextRequest) {
  const user = await requireElevated();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("library_state")
    .upsert({ id: 1, data: body, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (error) { console.error("[library] upsert error:", error); return NextResponse.json({ error: "Erreur de sauvegarde" }, { status: 500 }); }
  return NextResponse.json({ success: true });
}
