import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/me/vacation
 * Active ou désactive le mode vacances de l'utilisateur connecté.
 * Body: { vacationMode: boolean }
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vacationMode } = await req.json().catch(() => ({}));
  if (typeof vacationMode !== "boolean") {
    return NextResponse.json({ error: "vacationMode doit être un booléen" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ vacation_mode: vacationMode })
    .eq("id", user.id);

  if (error) {
    console.error("[me/vacation] error:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, vacationMode });
}
