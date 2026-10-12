import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { groupIdsFor } from "@/lib/groupIds";

/**
 * GET /api/home/feed
 * Cartes automatiques du carrousel d'accueil, calculées sur le GROUPE de l'appelant
 * (son coach + les sportifs de ce coach) :
 *  - anniversaires du jour ;
 *  - liste défilante des compétitions à venir (nom, épreuve, date) ;
 *  - liste défilante des anniversaires des 30 prochains jours.
 * Confidentialité : seuls les membres ayant coché « partager avec le groupe »
 * (profile.shareWins) sont concernés. Jamais d'âge, d'email ni de date de naissance.
 */
export const dynamic = "force-dynamic";

const BDAY_DAYS = 30;
const MAX_ROWS = 30;
/** « Prénom N. » : prénom + initiale du nom, jamais le nom complet. */
const shortName = (n: string) => {
  const p = (n || "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "Un membre";
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0].toUpperCase()}.` : p[0];
};
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const frDay = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

function parisMonthDay(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", month: "2-digit", day: "2-digit" })
    .format(new Date())
    .slice(-5)
    .replace("/", "-"); // MM-DD
}

function parisDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()); // YYYY-MM-DD
}

type Row3 = { who: string; what: string; when: string };
type Card = { id: string; kind: "birthday" | "goal" | "list"; label: string; title: string; text: string; color: string; rows?: Row3[] };

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
  const goalRows: (Row3 & { iso: string })[] = [];
  const bdayRows: (Row3 & { iso: string })[] = [];

  type Row = {
    user_id: string; name: string | null; birth: string | null; share: boolean | null;
    goals: { id: string; competition?: string; date?: string; place?: string }[] | null;
  };

  for (const r of ((states as unknown as Row[] | null) ?? [])) {
    const isMe = r.user_id === user.id;
    const name = shortName(r.name || profName.get(r.user_id) || "");
    const shares = r.share === true;

    // Anniversaire : partagé avec le groupe, ou toujours pour la personne elle-même.
    if ((shares || isMe) && r.birth && r.birth.slice(5) === today) {
      cards.push({
        id: `bd-${r.user_id}`, kind: "birthday", label: "Anniversaire", color: "#ffb300",
        title: isMe ? `Joyeux anniversaire ${name} !` : `Joyeux anniversaire ${name} !`,
        text: isMe ? "Toute l'équipe te souhaite une belle journée." : "Pense à lui envoyer un petit mot dans le chat.",
      });
    }

    if (!shares && !isMe) continue; // listes : seulement avec l'accord de la personne

    // Compétitions à venir
    for (const g of r.goals ?? []) {
      if (!g.date || !g.competition || g.date < todayIso) continue;
      goalRows.push({ iso: g.date, who: name, what: g.competition, when: frDay(g.date) });
    }

    // Prochains anniversaires (jour exact masqué : prénom + initiale, jamais l'âge)
    if (r.birth && r.birth.length >= 10 && r.birth.slice(5) !== today) {
      const y = Number(todayIso.slice(0, 4));
      for (const yy of [y, y + 1]) {
        const iso = `${yy}-${r.birth.slice(5, 10)}`;
        const n = Math.round((Date.parse(iso) - Date.parse(todayIso)) / 86_400_000);
        if (n > 0 && n <= BDAY_DAYS) { bdayRows.push({ iso, who: name, what: "Anniversaire", when: frDay(iso) }); break; }
      }
    }
  }

  const strip = (rows: (Row3 & { iso: string })[]): Row3[] =>
    rows.sort((x, y) => x.iso.localeCompare(y.iso)).slice(0, MAX_ROWS).map(({ who, what, when }) => ({ who, what, when }));
  const lists: Card[] = [];
  if (goalRows.length > 0) {
    lists.push({ id: "list-goals", kind: "list", label: "Compétitions à venir", color: "#66bb6a", title: "", text: "", rows: strip(goalRows) });
  }
  if (bdayRows.length > 0) {
    lists.push({ id: "list-bdays", kind: "list", label: "Anniversaires à venir", color: "#ffb300", title: "", text: "", rows: strip(bdayRows) });
  }
  // Anniversaires du jour d'abord, puis les listes défilantes.
  const bd = cards.filter((c) => c.kind === "birthday");
  return NextResponse.json({ cards: [...bd, ...lists] });
}
