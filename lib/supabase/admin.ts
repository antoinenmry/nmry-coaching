import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Client Supabase avec la service role key — accès admin complet.
 * À utiliser UNIQUEMENT dans les route handlers côté serveur.
 * Ne jamais exposer SUPABASE_SERVICE_ROLE_KEY au navigateur.
 */
export function createAdminClient() {
  return createClient(URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
