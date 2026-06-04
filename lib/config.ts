/* =========================================================================
   Interrupteurs de l'application.
   ========================================================================= */

// Connexion par email (Supabase).
//   false → MODE LOCAL : l'app s'ouvre sans login, données stockées dans le
//           navigateur (localStorage). Pratique pour développer l'interface.
//   true  → connexion Supabase + sauvegarde en ligne + rôles coach/client.
export const AUTH_ENABLED = false;
