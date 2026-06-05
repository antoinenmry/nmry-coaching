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
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const response = NextResponse.redirect(new URL(next, request.url));
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
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
