import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireCoach() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "coach") return null;
  return user;
}

/**
 * DELETE /api/coach/athletes/[id]
 * Supprime définitivement le compte sportif (auth + cascade profiles/app_state).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const coach = await requireCoach();
  if (!coach) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Sécurité : ne pas supprimer un compte coach
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === "coach") {
    return NextResponse.json({ error: "Impossible de supprimer un compte coach." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/coach/athletes/[id]
 * Met à jour le statut du sportif : { status: "active" | "inactive" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const coach = await requireCoach();
  if (!coach) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status } = body as { status?: string };

  if (status !== "active" && status !== "inactive") {
    return NextResponse.json({ error: "status invalide" }, { status: 400 });
  }

  // On utilise le client admin pour contourner la RLS (le coach ne peut pas
  // mettre à jour les profils des autres via la policy profiles_self_update).
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
