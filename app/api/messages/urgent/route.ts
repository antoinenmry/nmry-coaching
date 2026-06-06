import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/messages/urgent
 * Déclenche un email d'alerte au coach lorsqu'un sportif envoie un message urgent.
 *
 * Body: { clientId: string, messageText: string, clientName: string }
 */
export async function POST(req: NextRequest) {
  // 1. Vérifier que l'appelant est bien authentifié
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, messageText, clientName } = await req.json();
  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

  const admin = createAdminClient();

  // 2. Trouver le coach affecté au client
  const { data: assignment } = await admin
    .from("coach_client")
    .select("coach_id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!assignment?.coach_id) {
    // Pas de coach affecté — pas d'email à envoyer, ce n'est pas une erreur
    return NextResponse.json({ sent: false, reason: "no_coach_assigned" });
  }

  // 3. Récupérer l'email du coach
  const { data: coach } = await admin
    .from("profiles")
    .select("email, name")
    .eq("id", assignment.coach_id)
    .maybeSingle();

  if (!coach?.email) {
    return NextResponse.json({ sent: false, reason: "coach_email_not_found" });
  }

  // 4. Envoyer l'email via Resend
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "NMRY Coaching <onboarding@resend.dev>";
  const senderLabel = clientName || "Un sportif";
  const preview = messageText
    ? messageText.slice(0, 200)
    : "🎤 Message vocal";

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [coach.email],
    subject: `🚨 Message urgent de ${senderLabel} — NMRY Coaching`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
    <!-- Header -->
    <div style="background:#ef4444;padding:24px 28px;">
      <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;">NMRY Coaching</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:800;">🚨 Message urgent</h1>
    </div>

    <!-- Corps -->
    <div style="padding:28px;">
      <p style="margin:0 0 6px;color:#a0a0a0;font-size:13px;">De la part de</p>
      <p style="margin:0 0 20px;color:#ffffff;font-size:18px;font-weight:700;">${senderLabel}</p>

      ${messageText ? `
      <div style="background:#262626;border-left:3px solid #ef4444;border-radius:8px;padding:16px 18px;margin-bottom:24px;">
        <p style="margin:0;color:#e5e5e5;font-size:15px;line-height:1.55;">${preview}</p>
      </div>
      ` : `
      <div style="background:#262626;border-left:3px solid #ef4444;border-radius:8px;padding:16px 18px;margin-bottom:24px;">
        <p style="margin:0;color:#a0a0a0;font-size:14px;">🎤 Message vocal — écouter dans l'application</p>
      </div>
      `}

      <a href="https://nmry-coaching.vercel.app/followup"
         style="display:inline-block;background:#f59e0b;color:#1a1500;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;">
        Ouvrir les messages →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;border-top:1px solid #2a2a2a;">
      <p style="margin:0;color:#555;font-size:12px;">
        Cet email a été envoyé automatiquement par NMRY Coaching car un message a été marqué comme urgent.
      </p>
    </div>
  </div>
</body>
</html>`,
  });

  if (error) {
    console.error("[NMRY] Resend error:", error);
    return NextResponse.json({ sent: false, reason: error.message }, { status: 500 });
  }

  return NextResponse.json({ sent: true });
}
