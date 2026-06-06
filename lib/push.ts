import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

webpush.setVapidDetails(
  "mailto:contact@nmry-coaching.fr",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Envoie une notification push à un utilisateur (par son user_id Supabase).
 * Supprime silencieusement les souscriptions expirées/invalides.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const admin = createAdminClient();

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return;

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
      } catch (err: unknown) {
        // 410 Gone ou 404 = souscription invalide → supprimer
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
        throw err;
      }
    })
  );

  return results;
}

/**
 * Envoie une notification push à tous les sportifs d'un coach.
 */
export async function sendPushToCoachClients(coachId: string, payload: PushPayload) {
  const admin = createAdminClient();

  const { data: links } = await admin
    .from("coach_client")
    .select("client_id")
    .eq("coach_id", coachId);

  if (!links?.length) return;

  await Promise.allSettled(
    links.map((l) => sendPushToUser(l.client_id, payload))
  );
}
