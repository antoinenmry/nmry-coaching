import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/me/vacation-status
 * Retourne les dates de vacances de l'utilisateur connecté.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("vacation_start,vacation_end")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    vacationStart: data?.vacation_start ?? null,
    vacationEnd: data?.vacation_end ?? null,
  });
}
