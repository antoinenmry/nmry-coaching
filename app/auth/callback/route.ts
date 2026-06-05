import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Échange le code PKCE (lien dans l'email de confirmation / reset) contre une
 * session Supabase, puis redirige vers `next` (par défaut "/").
 *
 * Supabase pointe vers cette URL quand `emailRedirectTo` est configuré ainsi :
 *   `${origin}/auth/callback` (confirmation d'inscription)
 *   `${origin}/auth/callback?next=/auth/reset-password` (reset de mot de passe)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  // Valider next pour éviter l'open redirect (chemin relatif uniquement)
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (code && url && anonKey) {
    const response = NextResponse.redirect(new URL(next, request.url));
    const supabase = createServerClient(url, anonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }

  return NextResponse.redirect(
    new URL("/login?error=lien_invalide", request.url),
  );
}
