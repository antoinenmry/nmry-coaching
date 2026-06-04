import { createBrowserClient } from "@supabase/ssr";

// Valeurs de repli pour que le build n'échoue pas quand les variables ne sont
// pas définies (ex. mode local). Le client n'est réellement sollicité que si
// AUTH_ENABLED = true, auquel cas les vraies variables doivent être présentes.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

/** Client Supabase côté navigateur (composants client). */
export function createClient() {
  return createBrowserClient(URL, ANON_KEY);
}
