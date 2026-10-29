import nodemailer from "nodemailer";
import { DEFAULT_COACH_EMAIL } from "@/lib/config";

export const SITE_URL = "https://nmry-coaching.vercel.app";

/** Échappement HTML pour toute valeur saisie par un utilisateur insérée dans un mail. */
export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * Transport d'envoi :
 *  - SMTP du domaine (OVH) si SMTP_HOST / SMTP_USER / SMTP_PASSWORD sont définis ;
 *  - sinon repli sur Gmail (GMAIL_USER / GMAIL_APP_PASSWORD) comme avant.
 * Retourne null si rien n'est configuré.
 */
function getTransport() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_PORT, GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASSWORD) {
    const port = Number(SMTP_PORT) || 465;
    return {
      transporter: nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
      }),
      from: `NMRY Coaching <${process.env.MAIL_FROM_ADDRESS || "no-reply@nmry.fr"}>`,
    };
  }
  if (GMAIL_USER && GMAIL_APP_PASSWORD) {
    return {
      transporter: nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } }),
      from: `NMRY Coaching <${GMAIL_USER}>`,
    };
  }
  return null;
}

/**
 * Envoie un mail NMRY. Sujet préfixé « [NMRY] » (un seul filtre Gmail suffit pour les ranger).
 * Une copie cachée part à MAIL_BCC (défaut : coach par défaut) sauf s'il est déjà destinataire.
 * @returns false si aucun transport n'est configuré. Lève en cas d'erreur d'envoi.
 */
export async function sendMail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const t = getTransport();
  if (!t) return false;
  const bcc = (process.env.MAIL_BCC ?? DEFAULT_COACH_EMAIL).trim();
  await t.transporter.sendMail({
    from: t.from,
    to: opts.to,
    bcc: bcc && bcc.toLowerCase() !== opts.to.toLowerCase() ? bcc : undefined,
    subject: `[NMRY] ${opts.subject}`,
    html: opts.html,
  });
  return true;
}

/** Gabarit commun des mails de l'app (même habillage que les mails d'authentification). */
export function mailLayout(o: {
  eyebrow: string;
  title: string;
  accent?: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footer: string;
}): string {
  const accent = o.accent ?? "#f59e0b";
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e5e5;">
    <div style="background:${accent};padding:24px 28px;">
      <p style="margin:0;color:#fff;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">${o.eyebrow}</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:800;">${o.title}</h1>
    </div>
    <div style="padding:28px;">
      ${o.bodyHtml}
      <a href="${o.ctaUrl}" style="display:inline-block;background:#f59e0b;color:#1a1500;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;">${o.ctaLabel}</a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f0f0f0;background:#fafafa;">
      <p style="margin:0;color:#aaa;font-size:12px;">${o.footer}</p>
    </div>
  </div>
</body>
</html>`;
}
