import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/apiAuth";
import { capitalizeName } from "@/lib/names";
import { SITE_URL } from "@/lib/mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/coach/athletes/invite
 * Body: { firstName, lastName, email }
 * Le coach ajoute un sportif : Supabase lui envoie le mail d'invitation (modèle « Invite user »),
 * le lien l'amène à choisir son mot de passe. Il est affecté d'office au coach qui l'invite,
 * donc aucune validation n'est nécessaire.
 */
export async function POST(req: NextRequest) {
  const caller = await requireRole(["coach", "admin"]);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const firstName = capitalizeName(String(body?.firstName ?? "")).slice(0, 60);
  const lastName = capitalizeName(String(body?.lastName ?? "")).slice(0, 60);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!firstName || !lastName) return NextResponse.json({ error: "Prénom et nom requis." }, { status: 400 });
  if (!EMAIL_RE.test(email) || email.length > 200) return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return NextResponse.json({ error: "Un compte existe déjà avec cet email." }, { status: 409 });

  const name = `${firstName} ${lastName}`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name, first_name: firstName, last_name: lastName },
    redirectTo: `${SITE_URL}/auth/reset-password`,
  });
  if (error || !data?.user) {
    console.error("[athletes/invite] error:", error);
    const already = /already|registered|exists/i.test(error?.message ?? "");
    return NextResponse.json(
      { error: already ? "Un compte existe déjà avec cet email." : "L'invitation n'a pas pu être envoyée. Réessaie." },
      { status: already ? 409 : 500 },
    );
  }

  // Le trigger handle_new_user crée le profil ; on garantit le nom puis on affecte le sportif.
  await admin.from("profiles").update({ name }).eq("id", data.user.id);
  const { error: linkError } = await admin
    .from("coach_client")
    .upsert({ coach_id: caller.user.id, client_id: data.user.id });
  if (linkError) {
    console.error("[athletes/invite] link error:", linkError);
    return NextResponse.json({ error: "Invitation envoyée, mais l'affectation a échoué : accepte-le dans les demandes d'inscription." }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.user.id });
}
