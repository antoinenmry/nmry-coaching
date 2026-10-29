import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Variante OTP (token_hash) — utilisée par Supabase selon la config du projet
 * (ex. flow "mailer OTP" plutôt que PKCE). Vérifie le token et crée la session.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Valider next pour éviter l'open redirect (chemin relatif uniquement)
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (token_hash && type && url && anonKey) {
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

    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // Confirmation d'inscription : prévenir les coachs (la session vient d'être posée dans `response`).
      if ((type === "signup" || type === "email") && next === "/" && data?.user) {
        const u = data.user;
        const cookie = response.cookies.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
        await fetch(new URL("/api/auth/on-signup", request.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ userName: u.user_metadata?.name || u.email, userEmail: u.email }),
        }).catch(() => {});
      }
      return response;
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=lien_invalide", request.url),
  );
}
