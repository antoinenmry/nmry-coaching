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
 * photo de profil, vocaux envoyés, photos et vidéos de sa conversation.
 * Les lignes en base (profil, app_state, messages) partent en cascade avec le compte.
 */
export async function purgeUserFiles(admin: Admin, userId: string) {
  await Promise.allSettled([
    purgeFolder(admin, "avatars", userId),
    purgeFolder(admin, "chat-attachments", userId),
    purgeFolder(admin, "chat-attachments", `chat/${userId}`),
  ]);
}
