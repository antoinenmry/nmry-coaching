import { createAdminClient } from "@/lib/supabase/admin";
import type { AppState, NotifPrefs } from "@/lib/types";

const DEFAULTS: NotifPrefs = {
  newMessage: true,
  newPlan: true,
  urgentMessage: true,
  newInjury: true,
  goalReminder: true,
  sessionReminder: true,
};

/**
 * Récupère les préférences de notifications d'un utilisateur depuis son app_state.
 * Retourne les valeurs par défaut (tout activé) si non configurées.
 */
export async function getUserNotifPrefs(userId: string): Promise<NotifPrefs> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_state")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  const prefs = (data?.data as AppState | undefined)?.preferences?.notifPrefs;
  return { ...DEFAULTS, ...prefs };
}
