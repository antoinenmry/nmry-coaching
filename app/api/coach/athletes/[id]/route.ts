import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireElevated() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("id,role").eq("id", user.id).maybeSingle();
  if (!profile || !["coach", "admin"].includes(profile.role)) return null;
  return { user, role: profile.role as "coach" | "admin" };
}

/**
 * DELETE /api/coach/athletes/[id]
 * Supprime définitivement le compte sportif (auth + cascade profiles/app_state).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireElevated();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Seul l'admin peut supprimer un coach ; un coach ne peut que supprimer des clients
  if (target.role !== "client" && caller.role !== "admin") {
    return NextResponse.json({ error: "Impossible de supprimer ce compte." }, { status: 403 });
  }

  const admin = createAdminClient();

  // Un coach ne peut supprimer que ses propres clients affectés
  if (caller.role === "coach") {
    const { data: link } = await admin
      .from("coach_client")
      .select("id")
      .eq("coach_id", caller.user.id)
      .eq("client_id", id)
      .maybeSingle();
    if (!link) return NextResponse.json({ error: "Ce sportif ne vous est pas affecté" }, { status: 403 });
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/coach/athletes/[id]
 * - status: "active" | "inactive"  (coach ou admin)
 * - role: "client" | "coach"       (admin uniquement)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireElevated();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status, role } = body as { status?: string; role?: string };

  const admin = createAdminClient();

  if (role !== undefined) {
    // Changement de rôle — admin uniquement
    if (caller.role !== "admin") return NextResponse.json({ error: "Admin requis" }, { status: 403 });
    if (!["client", "coach", "admin"].includes(role)) {
      return NextResponse.json({ error: "role invalide" }, { status: 400 });
    }
    const { error } = await admin.from("profiles").update({ role }).eq("id", id);
    if (error) { console.error("[athletes] role update error:", error); return NextResponse.json({ error: "Erreur interne" }, { status: 500 }); }
    return NextResponse.json({ success: true });
  }

  if (status !== "active" && status !== "inactive") {
    return NextResponse.json({ error: "Paramètre manquant ou invalide" }, { status: 400 });
  }

  // Un coach ne peut modifier que les clients qui lui sont affectés
  if (caller.role === "coach") {
    const { data: link } = await admin
      .from("coach_client")
      .select("id")
      .eq("coach_id", caller.user.id)
      .eq("client_id", id)
      .maybeSingle();
    if (!link) return NextResponse.json({ error: "Ce sportif ne vous est pas affecté" }, { status: 403 });
  }

  const { error } = await admin.from("profiles").update({ status }).eq("id", id);
  if (error) { console.error("[athletes] status update error:", error); return NextResponse.json({ error: "Erreur interne" }, { status: 500 }); }
  return NextResponse.json({ success: true });
}
