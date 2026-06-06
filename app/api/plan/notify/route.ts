import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { getUserNotifPrefs } from "@/lib/notifPrefs";

/**
 * POST /api/plan/notify
 * Coach notifie tous ses sportifs qu'un nouveau programme est disponible.
 * Vérifie les préférences de chaque sportif avant d'envoyer.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Vérifier que l'utilisateur est coach ou admin
  const { data: profile } = await admin
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Récupérer tous les sportifs du coach
  const { data: links } = await admin
    .from("coach_client")
    .select("client_id")
    .eq("coach_id", user.id);

  if (!links?.length) return NextResponse.json({ sent: 0 });

  const coachName = profile.name || "Votre coach";
  let sent = 0;

  await Promise.allSettled(
    links.map(async ({ client_id }) => {
      const prefs = await getUserNotifPrefs(client_id);
      if (!prefs.newPlan) return;
      await sendPushToUser(client_id, {
        title: "🗓️ Nouveau programme disponible",
        body: `${coachName} a mis à jour votre programmation`,
        url: "/plan",
      });
      sent++;
    })
  );

  return NextResponse.json({ sent });
}
