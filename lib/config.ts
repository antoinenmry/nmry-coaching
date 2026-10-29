/* =========================================================================
   Interrupteurs de l'application.
   ========================================================================= */

// Connexion par email (Supabase).
//   true  → connexion Supabase + sauvegarde en ligne + rôles coach/client.
//           L'écran de login propose aussi un mode "invité" (données locales).
//   false → MODE LOCAL forcé : l'app s'ouvre sans login, données navigateur.
export const AUTH_ENABLED = true;

// Coach « par défaut » : destinataire des demandes d'inscription par mail et éditeur d'annonces.
// Plus aucune affectation automatique : un nouveau sportif attend la validation d'un coach.
export const DEFAULT_COACH_EMAIL = "simon.nemery@gmail.com";

// Seuls ces comptes peuvent créer / modifier / supprimer les annonces du carrousel d'accueil
// (les autres coachs gardent tout le reste de leurs droits). Vérifié aussi côté serveur.
export const ANNOUNCEMENT_EDITORS = [DEFAULT_COACH_EMAIL, "antoine.nmry@gmail.com"].map((e) => e.toLowerCase());
export const canEditAnnouncements = (email?: string | null) =>
  !!email && ANNOUNCEMENT_EDITORS.includes(email.toLowerCase());
