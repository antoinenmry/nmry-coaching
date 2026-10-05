import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { groupIdsFor } from "@/lib/groupIds";

/**
 * GET /api/home/feed
 * Cartes automatiques du carrousel d'accueil, calculées sur le GROUPE de l'appelant
 * (son coach + les sportifs de ce coach) :
 *  - anniversaires du jour ;
 *  - records et badges des 7 derniers jours.
 * Confidentialité : seuls les membres ayant coché « partager avec le groupe »
 * (profile.shareWins) sont concernés. Jamais d'âge, d'email ni de date de naissance.
 */
export const dynamic = "force-dynamic";

const WIN_DAYS = 7;
const firstName = (n: string) => (n || "").trim().split(/\s+/)[0] || "Un membre";

function parisMonthDay(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", month: "2-digit", day: "2-digit" })
    .format(new Date())
    .slice(-5)
    .replace("/", "-"); // MM-DD
}

function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

type Card = { id: string; kind: "birthday" | "win"; label: string; title: string; text: string; color: string };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ cards: [] }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (me as { role?: string } | null)?.role ?? "client";
  const { ids } = await groupIdsFor(admin, user.id, role);
  if (ids.length === 0) return NextResponse.json({ cards: [] });

  const [{ data: states }, { data: profs }, { data: lib }] = await Promise.all([
    admin
      .from("app_state")
      .select("user_id, name:data->profile->>name, birth:data->profile->>birthDate, share:data->profile->shareWins, records:data->records, badges:data->badges")
      .in("user_id", ids),
    admin.from("profiles").select("id, name").in("id", ids),
    admin.from("library_state").select("data").eq("id", 1).maybeSingle(),
  ]);

  const profName = new Map(((profs as { id: string; name?: string }[] | null) ?? []).map((p) => [p.id, p.name ?? ""]));
  const challenges = ((lib?.data as { challenges?: { id: string; title: string }[] } | null)?.challenges ?? []);
  const chTitle = new Map(challenges.map((c) => [c.id, c.title]));

  const today = parisMonthDay();
  const cutoff = new Date(Date.now() - WIN_DAYS * 86_400_000).toISOString().slice(0, 10);
  const cards: Card[] = [];

  type Row = {
    user_id: string; name: string | null; birth: string | null; share: boolean | null;
    records: { strength?: { name?: string; exId: string; visible?: boolean; entries: { date: string; weight: number; reps: number }[] }[]; cap?: Record<string, { date: string; timeSeconds: number }[]>; hyrox?: Record<string, { date: string; timeSeconds: number }[]> } | null;
    badges: { challengeId: string; unlockedAt: string }[] | null;
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

    for (const ex of r.records?.strength ?? []) {
      if (ex.visible === false || !ex.entries?.length) continue;
      const best = [...ex.entries].sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0];
      if (best.date >= cutoff && ex.entries.length > 1) {
        cards.push({
          id: `win-${r.user_id}-${ex.exId}`, kind: "win", label: "Nouveau record", color: "#66bb6a",
          title: `${name} : ${ex.name ?? "record"}`, text: `${best.weight} kg × ${best.reps}`,
        });
      }
    }
    for (const group of [r.records?.cap ?? {}, r.records?.hyrox ?? {}]) {
      for (const [dist, entries] of Object.entries(group)) {
        if (!entries?.length || entries.length < 2) continue;
        const best = [...entries].sort((a, b) => a.timeSeconds - b.timeSeconds)[0];
        if (best.date >= cutoff) {
          cards.push({
            id: `win-${r.user_id}-${dist}`, kind: "win", label: "Nouveau record", color: "#66bb6a",
            title: `${name} : ${dist}`, text: fmtTime(best.timeSeconds),
          });
        }
      }
    }
    for (const b of r.badges ?? []) {
      if (b.unlockedAt >= cutoff && chTitle.has(b.challengeId)) {
        cards.push({
          id: `badge-${r.user_id}-${b.challengeId}`, kind: "win", label: "Badge débloqué", color: "#ab47bc",
          title: `${name} a débloqué « ${chTitle.get(b.challengeId)} »`, text: "Bravo !",
        });
      }
    }
  }

  // Anniversaires d'abord, puis 6 victoires maximum.
  const bd = cards.filter((c) => c.kind === "birthday");
  const wins = cards.filter((c) => c.kind === "win").slice(0, 6);
  return NextResponse.json({ cards: [...bd, ...wins] });
}
