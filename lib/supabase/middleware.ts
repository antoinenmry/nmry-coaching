import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ENABLED } from "@/lib/config";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Route publique : /login et les routes de callback /auth/* (confirmation email,
 *  reset mot de passe) qui s'exécutent AVANT que la session existe.
 *  `/api/dashboard/*` : routes en lecture seule pour le dashboard mural, protégées par
 *  leur propre secret (Authorization: Bearer DASHBOARD_SECRET) — pas par la session. */
function isPublicPath(path: string) {
  return (
    path === "/login" ||
    path.startsWith("/auth/") ||
    path.startsWith("/api/dashboard/")
  );
}

/** Supabase redirige vers la Site URL avec ?error= quand un lien est expiré/invalide.
 *  On intercepte ça uniquement sur la racine "/" pour éviter la boucle infinie
 *  (si on interceptait /login?error=… on bouclerait indéfiniment). */
function redirectSupabaseError(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") return null;
  const error = request.nextUrl.searchParams.get("error");
  if (!error) return null;
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "?error=lien_invalide";
  return NextResponse.redirect(url);
}

/** Redirige vers /login si la route est protégée et qu'il n'y a pas de session. */
function guardWithoutSession(request: NextRequest, response: NextResponse) {
  if (!isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

/** Rafraîchit la session (cookies) et protège les routes de l'app. */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Mode local : aucune protection, on laisse tout passer.
  if (!AUTH_ENABLED) return response;

  // Intercepte les erreurs Supabase renvoyées sur la Site URL (?error=access_denied…)
  const supabaseError = redirectSupabaseError(request);
  if (supabaseError) return supabaseError;

  // Supabase non configuré (variables d'env absentes, ex. déploiement sans
  // NEXT_PUBLIC_SUPABASE_*) : NE PAS construire le client (il lèverait une
  // exception → MIDDLEWARE_INVOCATION_FAILED). On dégrade en mode déconnecté :
  // login + invité restent accessibles, le reste redirige vers /login.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return guardWithoutSession(request, response);
  }

  let sessionResponse = response;
  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          sessionResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            sessionResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Supabase mal configuré ou injoignable : ne pas laisser l'exception remonter
  // (sinon MIDDLEWARE_INVOCATION_FAILED). On dégrade en mode déconnecté.
  let user = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
    return guardWithoutSession(request, sessionResponse);
  }

  const path = request.nextUrl.pathname;

  // Pas de session + page protégée -> /login
  if (!user && !isPublicPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  // Connecté (vrai compte) + page de login -> accueil
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return sessionResponse;
}
