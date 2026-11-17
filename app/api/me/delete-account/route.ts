import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCoachOf } from "@/lib/chat";
import { sendPushToUser } from "@/lib/push";
import { purgeUserFiles } from "@/lib/userFiles";

/**
 * POST /api/me/delete-account  Body: { confirm: "SUPPRIMER" }
 * Droit à l'effacement (RGPD art. 17) : un sportif supprime son compte et toutes ses données.
 * Les coachs et l'admin passent par l'administrateur (leurs sportifs dépendent de leur compte).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "SUPPRIMER") {
    return NextResponse.json({ error: "Confirmation manquante." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, name").eq("id", user.id).maybeSingle();
  if (profile?.role !== "client") {
    return NextResponse.json({ error: "Un compte coach se supprime via l'administrateur." }, { status: 403 });
  }

  const coachId = await getCoachOf(admin, user.id);
  await purgeUserFiles(admin, user.id);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[me/delete-account] error:", error.message);
    return NextResponse.json({ error: "La suppression a échoué. Réessaie ou écris à contact@nmry.fr." }, { status: 500 });
  }

  if (coachId) {
    await sendPushToUser(coachId, {
      title: "Compte supprimé",
      body: `${profile?.name || "Un sportif"} a supprimé son compte et ses données.`,
      url: "/settings?tab=sportifs",
    }).catch(() => {});
  }
  await supabase.auth.signOut().catch(() => {});
  return NextResponse.json({ success: true });
}
