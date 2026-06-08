import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/me/vacation
 * Définit ou efface la période de vacances de l'utilisateur connecté.
 * Body: { vacationStart: string | null, vacationEnd: string | null }
 *   vacationStart: "YYYY-MM-DD" ou null (null = effacer les vacances)
 *   vacationEnd:   "YYYY-MM-DD" ou null (null = pas de date de fin définie)
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { vacationStart, vacationEnd } = body as {
    vacationStart?: string | null;
    vacationEnd?: string | null;
  };

  // Validation : si vacationStart est fourni, doit être une date valide
  if (vacationStart !== null && vacationStart !== undefined) {
    if (typeof vacationStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(vacationStart)) {
      return NextResponse.json({ error: "vacationStart doit être au format YYYY-MM-DD" }, { status: 400 });
    }
  }
  if (vacationEnd !== null && vacationEnd !== undefined) {
    if (typeof vacationEnd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(vacationEnd)) {
      return NextResponse.json({ error: "vacationEnd doit être au format YYYY-MM-DD" }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      vacation_start: vacationStart ?? null,
      vacation_end: vacationEnd ?? null,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[me/vacation] error:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, vacationStart: vacationStart ?? null, vacationEnd: vacationEnd ?? null });
}
