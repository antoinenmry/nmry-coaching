import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { sendMail, mailLayout, esc, SITE_URL } from "@/lib/mail";
import { DEFAULT_COACH_EMAIL } from "@/lib/config";

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

  // Anti-replay : l'inscription ou la confirmation email doit être récente (< 5 min).
  // - Path session immédiate (email confirm désactivé) : on vérifie created_at
  // - Path confirmation email (normal) : on vérifie email_confirmed_at (mis à jour au clic du lien)
  // Un utilisateur existant a ces deux timestamps anciens → rejeté.
  const createdAt    = new Date(user.created_at         ?? 0).getTime();
  const confirmedAt  = new Date(user.email_confirmed_at ?? 0).getTime();
  const mostRecent   = Math.max(createdAt, confirmedAt);
  if (Date.now() - mostRecent > 5 * 60 * 1000) {
    return NextResponse.json({ skipped: true, reason: "not_new" });
  }

  const { userName, userEmail } = await req.json().catch(() => ({}));
  const displayName = userName || userEmail || "Nouvel utilisateur";

  const admin = createAdminClient();

  // Pas d'affectation automatique : le compte reste sans accès jusqu'à validation par un coach.

  // Mail de demande de validation (destinataire : MAIL_SIGNUP_TO, défaut = coach par défaut ; copie cachée gérée par sendMail).
  // Les valeurs viennent du client → échappées ; échec d'envoi sans conséquence sur l'inscription.
  await sendMail({
    to: process.env.MAIL_SIGNUP_TO || DEFAULT_COACH_EMAIL,
    subject: `Demande d'inscription — ${displayName}`,
    html: mailLayout({
      eyebrow: "NMRY Coaching",
      title: "👤 Nouvelle demande d'inscription",
      bodyHtml:
        `<p style="margin:0 0 4px;color:#888;font-size:13px;">Nom</p>` +
        `<p style="margin:0 0 16px;color:#111;font-size:20px;font-weight:700;">${esc(String(userName || "—"))}</p>` +
        `<p style="margin:0 0 4px;color:#888;font-size:13px;">Email</p>` +
        `<p style="margin:0 0 24px;color:#111;font-size:16px;">${esc(String(userEmail || user.email || "—"))}</p>` +
        `<p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">Cette personne n'a accès à rien tant que tu n'as pas accepté sa demande.</p>`,
      ctaLabel: "Accepter ou refuser →",
      ctaUrl: `${SITE_URL}/settings?tab=sportifs`,
      footer: "Email automatique — NMRY Coaching · demande d'inscription",
    }),
  }).catch((e) => console.error("[NMRY] mail inscription :", e));

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
        title: "👤 Demande d'inscription",
        body: `${displayName} demande à rejoindre NMRY Coaching — à valider`,
        url: "/settings?tab=sportifs",
      })
    )
  );

  return NextResponse.json({ sent: elevated.length });
}
