import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Supprime tous les fichiers d'un dossier Storage (une page de 1 000 suffit largement ici). */
async function purgeFolder(admin: Admin, bucket: string, folder: string) {
  const { data } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
  const paths = (data ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
  if (paths.length) await admin.storage.from(bucket).remove(paths);
}

/**
 * Efface les fichiers personnels d'un compte avant sa suppression (RGPD, droit à l'effacement) :
 * photo de profil, vocaux envoyés, photos, vidéos et vocaux de sa conversation.
 * Les lignes en base (profil, app_state, messages) partent en cascade avec le compte.
 */
export async function purgeUserFiles(admin: Admin, userId: string) {
  // Fichiers rattachés aux messages de sa conversation, où qu'ils soient rangés : vocaux du coach
  // (dossier du coach), vocaux migrés (audio-migration/…). Les messages partent en cascade, pas les fichiers.
  const { data: rows } = await admin
    .from("chat_messages")
    .select("attachment_path, audio_path")
    .or(`client_id.eq.${userId},sender_id.eq.${userId}`);
  const linked = (rows ?? [])
    .flatMap((r) => [(r as { attachment_path?: string | null }).attachment_path, (r as { audio_path?: string | null }).audio_path])
    .filter((p): p is string => !!p);
  for (let i = 0; i < linked.length; i += 500) {
    await admin.storage.from("chat-attachments").remove(linked.slice(i, i + 500)).catch(() => {});
  }
  await Promise.allSettled([
    purgeFolder(admin, "avatars", userId),
    purgeFolder(admin, "chat-attachments", userId),
    purgeFolder(admin, "chat-attachments", `chat/${userId}`),
  ]);
}
