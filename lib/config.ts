/* =========================================================================
   Interrupteurs de l'application.
   ========================================================================= */

// Connexion par email (Supabase).
//   true  → connexion Supabase + sauvegarde en ligne + rôles coach/client.
//           L'écran de login propose aussi un mode "invité" (données locales).
//   false → MODE LOCAL forcé : l'app s'ouvre sans login, données navigateur.
export const AUTH_ENABLED = true;

// Coach affecté d'office à chaque nouveau sportif inscrit.
// L'admin peut réaffecter librement ensuite (Réglages → Admin) : l'affectation
// automatique ne s'applique qu'aux comptes qui n'ont encore aucun coach.
// Mettre "" pour désactiver l'affectation automatique.
export const DEFAULT_COACH_EMAIL = "simon.nemery@gmail.com";

// Seuls ces comptes peuvent créer / modifier / supprimer les annonces du carrousel d'accueil
// (les autres coachs gardent tout le reste de leurs droits). Vérifié aussi côté serveur.
export const ANNOUNCEMENT_EDITORS = [DEFAULT_COACH_EMAIL, "antoine.nmry@gmail.com"].map((e) => e.toLowerCase());
export const canEditAnnouncements = (email?: string | null) =>
  !!email && ANNOUNCEMENT_EDITORS.includes(email.toLowerCase());
