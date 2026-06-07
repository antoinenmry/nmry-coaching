import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import nodemailer from "nodemailer";
import { sendPushToUser } from "@/lib/push";
import { getUserNotifPrefs } from "@/lib/notifPrefs";

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

  // 4. Vérifier que Gmail est configuré
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn("[NMRY] GMAIL_USER ou GMAIL_APP_PASSWORD manquant — email non envoyé");
    return NextResponse.json({ sent: false, reason: "gmail_not_configured" });
  }

  // 5. Envoyer via Gmail SMTP
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const senderLabel = clientName || "Un sportif";
  const preview = messageText ? messageText.slice(0, 200) : null;

  try {
    await transporter.sendMail({
      from: `NMRY Coaching <${process.env.GMAIL_USER}>`,
      to: coachEmail,
      subject: `🚨 Message urgent de ${senderLabel} — NMRY Coaching`,
      html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e5e5;">

    <!-- Header rouge -->
    <div style="background:#ef4444;padding:24px 28px;">
      <p style="margin:0;color:#fff;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">NMRY Coaching</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:800;">🚨 Message urgent</h1>
    </div>

    <!-- Corps -->
    <div style="padding:28px;">
      <p style="margin:0 0 4px;color:#888;font-size:13px;">De la part de</p>
      <p style="margin:0 0 24px;color:#111;font-size:20px;font-weight:700;">${senderLabel}</p>

      ${preview ? `
      <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px 18px;margin-bottom:28px;">
        <p style="margin:0;color:#333;font-size:15px;line-height:1.6;">${preview}</p>
      </div>
      ` : `
      <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px 18px;margin-bottom:28px;">
        <p style="margin:0;color:#888;font-size:14px;">🎤 Message vocal — écouter dans l'application</p>
      </div>
      `}

      <a href="https://nmry-coaching.vercel.app/followup"
         style="display:inline-block;background:#f59e0b;color:#1a1500;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;">
        Ouvrir les messages →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;border-top:1px solid #f0f0f0;background:#fafafa;">
      <p style="margin:0;color:#aaa;font-size:12px;">
        Email automatique — NMRY Coaching · message marqué comme urgent
      </p>
    </div>

  </div>
</body>
</html>`,
    });
  } catch (err) {
    console.error("[NMRY] Gmail SMTP error:", err);
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
