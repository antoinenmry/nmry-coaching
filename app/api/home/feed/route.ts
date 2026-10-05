import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { groupIdsFor } from "@/lib/groupIds";

/**
 * GET /api/home/feed
 * Cartes automatiques du carrousel d'accueil, calculées sur le GROUPE de l'appelant
 * (son coach + les sportifs de ce coach) :
 *  - anniversaires du jour ;
 *  - compétitions des 7 prochains jours (« Antoine participe à … demain ! »).
 * Confidentialité : seuls les membres ayant coché « partager avec le groupe »
 * (profile.shareWins) sont concernés. Jamais d'âge, d'email ni de date de naissance.
 */
export const dynamic = "force-dynamic";

const GOAL_DAYS = 7;
const firstName = (n: string) => (n || "").trim().split(/\s+/)[0] || "Un membre";

function parisMonthDay(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", month: "2-digit", day: "2-digit" })
    .format(new Date())
    .slice(-5)
    .replace("/", "-"); // MM-DD
}

function parisDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()); // YYYY-MM-DD
}

type Card = { id: string; kind: "birthday" | "goal"; label: string; title: string; text: string; color: string };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ cards: [] }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (me as { role?: string } | null)?.role ?? "client";
  const { ids } = await groupIdsFor(admin, user.id, role);
  if (ids.length === 0) return NextResponse.json({ cards: [] });

  const [{ data: states }, { data: profs }] = await Promise.all([
    admin
      .from("app_state")
      .select("user_id, name:data->profile->>name, birth:data->profile->>birthDate, share:data->profile->shareWins, goals:data->goals")
      .in("user_id", ids),
    admin.from("profiles").select("id, name").in("id", ids),
  ]);

  const profName = new Map(((profs as { id: string; name?: string }[] | null) ?? []).map((p) => [p.id, p.name ?? ""]));
  const today = parisMonthDay();
  const todayIso = parisDate();
  const cards: Card[] = [];

  type Row = {
    user_id: string; name: string | null; birth: string | null; share: boolean | null;
    goals: { id: string; competition?: string; date?: string; place?: string }[] | null;
  };

  for (const r of ((states as unknown as Row[] | null) ?? [])) {
    const isMe = r.user_id === user.id;
    const name = firstName(r.name || profName.get(r.user_id) || "");
    const shares = r.share === true;

    // Anniversaire : partagé avec le groupe, ou toujours pour la personne elle-même.
    if ((shares || isMe) && r.birth && r.birth.slice(5) === today) {
      cards.push({
        id: `bd-${r.user_id}`, kind: "birthday", label: "Anniversaire", color: "#ffb300",
        title: isMe ? `Joyeux anniversaire ${name} !` : `Joyeux anniversaire ${name} !`,
        text: isMe ? "Toute l'équipe te souhaite une belle journée." : "Pense à lui envoyer un petit mot dans le chat.",
      });
    }

    if (isMe || !shares) continue; // victoires des AUTRES, avec leur accord

    // Compétitions à venir (7 jours), des AUTRES, avec leur accord.
    for (const g of r.goals ?? []) {
      if (!g.date || !g.competition) continue;
      const n = Math.round((Date.parse(g.date) - Date.parse(todayIso)) / 86_400_000);
      if (n < 0 || n > GOAL_DAYS) continue;
      const when = n === 0 ? "aujourd'hui" : n === 1 ? "demain" : `dans ${n} jours`;
      cards.push({
        id: `goal-${r.user_id}-${g.id}-${n}`, kind: "goal", label: "Compétition", color: "#66bb6a",
        title: `${name} participe à ${g.competition} ${when} !`,
        text: g.place ? `${g.place} · un petit mot d'encouragement dans le chat ?` : "Un petit mot d'encouragement dans le chat ?",
      });
      void n;
    }
  }

  // Anniversaires d'abord, puis 6 compétitions maximum (les plus proches en premier).
  const bd = cards.filter((c) => c.kind === "birthday");
  const goals = cards.filter((c) => c.kind === "goal").slice(0, 6);
  return NextResponse.json({ cards: [...bd, ...goals] });
}
