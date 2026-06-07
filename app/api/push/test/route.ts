import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/push/test
 * Envoie une notification push de test à l'utilisateur courant et renvoie
 * un diagnostic détaillé (erreurs réelles incluses) pour debug à distance.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Diagnostic config VAPID
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    return NextResponse.json({
      ok: false,
      stage: "config",
      message: "Clés VAPID manquantes côté serveur",
      hasPublic: !!pub,
      hasPrivate: !!priv,
    });
  }

  try {
    webpush.setVapidDetails("mailto:contact@nmry-coaching.fr", pub, priv);
  } catch (e) {
    return NextResponse.json({
      ok: false,
      stage: "config",
      message: "Configuration VAPID invalide",
      detail: (e as Error).message,
    });
  }

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user.id);

  if (!subs?.length) {
    return NextResponse.json({
      ok: false,
      stage: "no_subscription",
      message: "Aucune souscription enregistrée en base pour cet utilisateur. Clique 'Activer' puis réessaie.",
      subscriptionsInDb: 0,
    });
  }

  const payload = JSON.stringify({
    title: "🔔 Test NMRY",
    body: "Si tu vois ceci, les notifications fonctionnent !",
    url: "/settings",
  });

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        return { endpoint: sub.endpoint.slice(0, 40) + "…", status: "sent" };
      } catch (err: unknown) {
        const e = err as { statusCode?: number; body?: string; message?: string };
        // Nettoyer les souscriptions mortes
        if (e.statusCode === 410 || e.statusCode === 404) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
        return {
          endpoint: sub.endpoint.slice(0, 40) + "…",
          status: "failed",
          statusCode: e.statusCode,
          detail: e.body || e.message,
        };
      }
    }),
  );

  const outcomes = results.map((r) =>
    r.status === "fulfilled" ? r.value : { status: "failed", detail: String(r.reason) },
  );
  const sent = outcomes.filter((o) => o.status === "sent").length;

  return NextResponse.json({
    ok: sent > 0,
    stage: "sent",
    subscriptionsInDb: subs.length,
    sent,
    failed: outcomes.length - sent,
    outcomes,
  });
}
