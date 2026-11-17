/** Version de la politique de confidentialité : la changer redemande l'accord de chacun. */
export const PRIVACY_VERSION = "2026-11";

/** Contact pour exercer ses droits (adresse principale du domaine). */
export const PRIVACY_CONTACT = "contact@nmry.fr";

/** Accord enregistré dans les métadonnées du compte Supabase (pas de table en plus). */
export const consentMetadata = () => ({
  privacy_version: PRIVACY_VERSION,
  privacy_consent_at: new Date().toISOString(),
});
