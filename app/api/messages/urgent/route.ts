import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail, mailLayout, esc, SITE_URL } from "@/lib/mail";
import { sendPushToUser } from "@/lib/push";
import { getUserNotifPrefs } from "@/lib/notifPrefs";
import { rateLimit } from "@/lib/rateLimit";

/**
 * POST /api/messages/urgent
 * Déclenche un email d'alerte au coach lorsqu'un sportif envoie un message urgent.
 * Utilise Gmail SMTP avec un mot de passe d'application Google.
 *
 * Variables d'env requises :
 *   GMAIL_USER         ex: simon.nemery@gmail.com
 *   GMAIL_APP_PASSWORD ex: abcdefghijklmnop (16 chars, sans espaces)
 *
 * Body: { clientId: string, messageText: string, clientName: string }
 */
export async function POST(req: NextRequest) {
  // 1. Vérifier que l'appelant est bien authentifié
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, messageText, clientName } = await req.json().catch(() => ({}));
  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

  // Vérifier que clientId correspond bien à l'utilisateur connecté (anti-usurpation)
  if (clientId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Anti-spam : au plus 3 emails urgents / minute par sportif (email + push au coach).
  const rl = rateLimit(`urgent:${user.id}`, 3, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de messages urgents, réessaie dans un instant." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const admin = createAdminClient();

  // 2. Trouver le coach affecté au client
  const { data: assignment } = await admin
    .from("coach_client")
    .select("coach_id")
    .eq("client_id", clientId)
    .maybeSingle();

  let coachId: string;
  let coachEmail: string;

  if (assignment?.coach_id) {
    // Cas normal : coach lié via coach_client
    const { data: coachProfile } = await admin
      .from("profiles")
      .select("email, name")
      .eq("id", assignment.coach_id)
      .maybeSingle();
    if (!coachProfile?.email) {
      return NextResponse.json({ sent: false, reason: "coach_email_not_found" });
    }
    coachId = assignment.coach_id;
    coachEmail = coachProfile.email;
  } else {
    // Fallback : pas de coach_client → notifier le premier admin trouvé
    const { data: admins } = await admin
      .from("profiles")
      .select("id, email")
      .eq("role", "admin")
      .limit(1);
    if (!admins?.length || !admins[0].email) {
      return NextResponse.json({ sent: false, reason: "no_coach_assigned" });
    }
    coachId = admins[0].id;
    coachEmail = admins[0].email;
  }

  const senderLabel = clientName || "Un sportif";
  const preview = messageText ? messageText.slice(0, 200) : null;

  // Échappement HTML (anti-injection : un sportif ne peut pas injecter de balises/liens via son nom ou son message).
  const quote = (inner: string, color: string) =>
    `<div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px 18px;margin-bottom:28px;"><p style="margin:0;color:${color};font-size:15px;line-height:1.6;">${inner}</p></div>`;

  try {
    const sent = await sendMail({
      to: coachEmail,
      subject: `🚨 Message urgent de ${senderLabel}`,
      html: mailLayout({
        eyebrow: "NMRY Coaching",
        title: "🚨 Message urgent",
        accent: "#ef4444",
        bodyHtml:
          `<p style="margin:0 0 4px;color:#888;font-size:13px;">De la part de</p>` +
          `<p style="margin:0 0 24px;color:#111;font-size:20px;font-weight:700;">${esc(senderLabel)}</p>` +
          (preview ? quote(esc(preview), "#333") : quote("🎤 Message vocal — écouter dans l&apos;application", "#888")),
        ctaLabel: "Ouvrir les messages →",
        ctaUrl: `${SITE_URL}/followup`,
        footer: "Email automatique — NMRY Coaching · message marqué comme urgent",
      }),
    });
    if (!sent) {
      console.warn("[NMRY] Aucun SMTP configuré (SMTP_* ou GMAIL_*) — email non envoyé");
      return NextResponse.json({ sent: false, reason: "mail_not_configured" });
    }
  } catch (err) {
    console.error("[NMRY] SMTP error:", err);
    return NextResponse.json({ sent: false, reason: "email_error" }, { status: 500 });
  }

  // Notification push au coach/admin si pref activée (fire-and-forget)
  getUserNotifPrefs(coachId).then((prefs) => {
    if (!prefs.urgentMessage) return;
    return sendPushToUser(coachId, {
      title: `🚨 Message urgent — ${senderLabel}`,
      body: messageText ? messageText.slice(0, 100) : "Message vocal urgent",
      url: "/followup",
    });
  }).catch(() => {});

  return NextResponse.json({ sent: true });
}
