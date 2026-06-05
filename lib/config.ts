/* =========================================================================
   Interrupteurs de l'application.
   ========================================================================= */

// Connexion par email (Supabase).
//   true  → connexion Supabase + sauvegarde en ligne + rôles coach/client.
//           L'écran de login propose aussi un mode "invité" (données locales).
//   false → MODE LOCAL forcé : l'app s'ouvre sans login, données navigateur.
export const AUTH_ENABLED = true;
