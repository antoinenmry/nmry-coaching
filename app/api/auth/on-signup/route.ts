import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";

/**
 * POST /api/auth/on-signup
 * Appelé côté client juste après supabase.auth.signUp().
 * Notifie tous les coaches et admins d'une nouvelle inscription.
 *
 * Body: { userName: string, userEmail: string }
 */
export async function POST(req: NextRequest) {
  // L'utilisateur vient de s'inscrire — il est authentifié
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Anti-replay : le compte doit avoir été créé il y a moins de 5 minutes
  const createdAt = new Date(user.created_at ?? 0).getTime();
  if (Date.now() - createdAt > 5 * 60 * 1000) {
    return NextResponse.json({ skipped: true, reason: "not_new" });
  }

  const { userName, userEmail } = await req.json().catch(() => ({}));
  const displayName = userName || userEmail || "Nouvel utilisateur";

  const admin = createAdminClient();

  // Récupérer tous les coaches et admins
  const { data: elevated } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["coach", "admin"]);

  if (!elevated?.length) return NextResponse.json({ sent: 0 });

  // Envoyer une push à chacun (fire-and-forget)
  await Promise.allSettled(
    elevated.map(({ id }) =>
      sendPushToUser(id, {
        title: "👤 Nouvelle inscription",
        body: `${displayName} vient de rejoindre NMRY Coaching`,
        url: "/settings",
      })
    )
  );

  return NextResponse.json({ sent: elevated.length });
}
