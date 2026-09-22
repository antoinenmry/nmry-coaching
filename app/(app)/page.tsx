"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useData } from "@/components/DataProvider";
import { daysUntil, countdownLabel } from "@/lib/dates";
import { challengesToUnlock, conditionText } from "@/lib/challenges";
import type { AppState, ExerciseLibrary, Challenge } from "@/lib/types";

// Tuiles de l'accueil : photo de fond (public/tiles, optimisées ~1200 px) + titre Lato.
// `strong` = photo claire → voile plus opaque pour garder le titre lisible.
const CARDS = [
  { href: "/profile",  title: "Mon profil",    img: "/tiles/profile.jpg",  pos: "50% 30%" },
  { href: "/plan",     title: "Programmation", img: "/tiles/plan.jpg",     pos: "55% 60%" },
  { href: "/goals",    title: "Objectifs",     img: "/tiles/goals.jpg",    pos: "40% 50%" },
  { href: "/records",  title: "Records",       img: "/tiles/records.jpg",  pos: "60% 40%" },
  { href: "/followup", title: "Mon suivi",     img: "/tiles/followup.jpg", pos: "55% 45%", strong: true },
  { href: "/library",  title: "Bibliothèque",  img: "/tiles/library.jpg",  pos: "50% 40%" },
];

/** Info dynamique réduite à une ligne de sous-titre sous le titre de la tuile. */
function cardSubtitle(info: CardInfo | null): string | null {
  if (!info) return null;
  // Symboles seuls (—, ✓, ☆, →) : le sous-titre suffit à dire l'état.
  if (!/[\p{L}\p{N}]/u.test(info.main)) return info.sub;
  return info.big ? `${info.main} ${info.sub}` : `${info.sub} · ${info.main}`;
}

// ─── Helpers info dynamique cartes ──────────────────────────────────────────

type CardInfo = {
  main: string;  // valeur principale (grande, impactante)
  sub: string;   // sous-titre discret
  big?: boolean; // true = valeur courte → très grand (chiffres, %, ✓…)
};

function getWeekBounds(): [string, string] {
  const d = new Date();
  const day = d.getDay(); // 0 = Dim
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return [fmt(mon), fmt(sun)];
}

function getCardInfo(
  href: string,
  state: AppState,
  library: ExerciseLibrary,
  today: string,
): CardInfo | null {
  const mode = state.preferences?.cardInfoMode?.[href] ?? "hidden";
  if (mode === "hidden") return null;

  switch (href) {
    case "/plan": {
      const upcoming = state.sessions
        .filter((s) => s.date && s.date >= today)
        .sort((a, b) => a.date!.localeCompare(b.date!));
      if (mode === "nextSession") {
        const name = upcoming[0]?.name;
        return name
          ? { main: name, sub: "Prochaine séance" }
          : { main: "—", sub: "Aucune séance prévue", big: true };
      }
      if (mode === "weekPct") {
        const [mon, sun] = getWeekBounds();
        const week = state.sessions.filter((s) => s.date && s.date >= mon && s.date <= sun);
        if (!week.length) return { main: "—", sub: "Aucune séance cette semaine", big: true };
        const done = week.filter((s) => s.done).length;
        return { main: `${Math.round((done / week.length) * 100)}%`, sub: "réalisées cette semaine", big: true };
      }
      if (mode === "remaining") {
        const n = upcoming.length;
        return { main: String(n), sub: n === 1 ? "séance à venir" : "séances à venir", big: true };
      }
      return null;
    }
    case "/records": {
      if (mode === "lastRecord") {
        let latest: { date: string; name: string; weight: number; reps: number } | null = null;
        for (const ex of state.records.strength) {
          for (const entry of ex.entries) {
            if (!latest || entry.date > latest.date)
              latest = { date: entry.date, name: ex.name ?? ex.exId, weight: entry.weight, reps: entry.reps };
          }
        }
        if (!latest) return { main: "—", sub: "Aucun record enregistré", big: true };
        return { main: `${latest.weight} kg × ${latest.reps}`, sub: latest.name };
      }
      if (mode === "chosenRecord") {
        const exId = state.preferences?.chosenRecordExerciseId;
        if (!exId) return { main: "→", sub: "Choisir un exercice (Settings)" };
        const exRec = state.records.strength.find((e) => e.exId === exId);
        if (!exRec?.entries.length) return { main: "—", sub: exRec?.name ?? exId };
        const best = [...exRec.entries].sort((a, b) => b.weight - a.weight)[0];
        return { main: `${best.weight} kg × ${best.reps}`, sub: exRec.name ?? exId };
      }
      return null;
    }
    case "/followup": {
      if (mode === "activeInjury") {
        const injury = state.followups.find((f) => f.type === "injury" && !f.dateEnd);
        if (!injury) return { main: "✓", sub: "Aucune blessure active", big: true };
        const txt = injury.text.length > 28 ? injury.text.slice(0, 28) + "…" : injury.text;
        return { main: txt, sub: "🤕 Blessure active" };
      }
      if (mode === "lastNote") {
        const last = [...state.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        if (!last?.text) return { main: "—", sub: "Aucune note", big: true };
        const txt = last.text.length > 36 ? last.text.slice(0, 36) + "…" : last.text;
        return { main: txt, sub: "Dernier bloc-note" };
      }
      return null;
    }
    case "/library": {
      if (mode === "exerciseCount") {
        const n = library.exercises.length;
        return { main: String(n), sub: `exercice${n > 1 ? "s" : ""} disponible${n > 1 ? "s" : ""}`, big: true };
      }
      if (mode === "favoriteExercise") {
        const favId = state.preferences?.favoriteExerciseId;
        if (!favId) return { main: "☆", sub: "Aucun favori défini", big: true };
        const fav = library.exercises.find((e) => e.id === favId);
        return fav ? { main: fav.name, sub: "⭐ Favori" } : { main: "☆", sub: "Favori introuvable", big: true };
      }
      return null;
    }
    default:
      return null;
  }
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Placeholder bannière Vue d'ensemble */}
      <div className="mb-3.5 h-[104px] rounded-[20px] bg-surface2" />
      {/* Grille 2×3 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-surface2" />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { me, state, library, loading, role, update, activeUserId } = useData();
  const today = new Date().toISOString().slice(0, 10);
  const isCoach = role === "coach" || role === "admin";
  const displayName = state.profile.name || me?.name || me?.email || "Moi";

  // Messages non lus + urgents — source unique de vérité : table chat_messages via API
  // (coach = total tous sportifs ; sportif = sa conversation). Remplace l'ancienne lecture
  // de app_state.data.messages, obsolète depuis la migration du chat.
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [coachUrgent, setCoachUrgent] = useState(0);

  // --- Badges : déblocage + pop-up de célébration ---
  const SEEN_KEY = "nmry_seen_badge_unlocks";
  const [seenBadges, setSeenBadges] = useState<Set<string>>(new Set());
  const [seenLoaded, setSeenLoaded] = useState(false);
  const seededRef = useRef(false);
  const isSelf = activeUserId === me?.id; // n'agir que sur SON propre profil (pas un client via coach)

  useEffect(() => {
    if (loading || !me) return;
    let cancelled = false;
    fetch("/api/chat/unread")
      .then(r => (r.ok ? r.json() : { count: 0, urgent: 0 }))
      .then(d => {
        if (cancelled) return;
        setUnreadMessages(d.count ?? 0);
        setCoachUrgent(d.urgent ?? 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loading, me]);

  // Seed du set "déjà vus" au 1er chargement réel : si aucune entrée localStorage,
  // on considère tous les badges DÉJÀ débloqués comme vus → pas de burst de pop-ups
  // au déploiement. Seuls les déblocages ULTÉRIEURS déclencheront la célébration.
  useEffect(() => {
    if (loading || seededRef.current) return;
    seededRef.current = true;
    const raw = typeof window !== "undefined" ? localStorage.getItem(SEEN_KEY) : null;
    if (raw === null) {
      const initial = (state.badges ?? []).map((b) => b.challengeId);
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(initial)); } catch {}
      setSeenBadges(new Set(initial));
    } else {
      try { setSeenBadges(new Set(JSON.parse(raw) as string[])); } catch { setSeenBadges(new Set()); }
    }
    setSeenLoaded(true);
  }, [loading, state.badges]);

  // Auto-unlock sur l'accueil (uniquement sur son propre profil) : dès qu'une condition
  // est remplie, on enregistre le badge — la pop-up suit via le set "déjà vus".
  useEffect(() => {
    if (loading || !me || !isSelf) return;
    const challenges = library.challenges ?? [];
    if (!challenges.length) return;
    const toUnlock = challengesToUnlock(challenges, state);
    if (!toUnlock.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    update((d) => {
      if (!d.badges) d.badges = [];
      toUnlock.forEach((id) => {
        if (!d.badges!.find((b) => b.challengeId === id)) {
          d.badges!.push({ challengeId: id, unlockedAt: stamp });
        }
      });
    });
  }, [loading, me, isSelf, state, library, update]);

  // Badges débloqués mais pas encore célébrés (résolus vers leur défi courant).
  const celebrate: Challenge[] = (!loading && isSelf && seenLoaded)
    ? (state.badges ?? [])
        .filter((b) => !seenBadges.has(b.challengeId))
        .map((b) => (library.challenges ?? []).find((c) => c.id === b.challengeId))
        .filter((c): c is Challenge => !!c)
    : [];

  function dismissCelebrated(id: string) {
    setSeenBadges((prev) => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem(SEEN_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  if (loading) return <DashboardSkeleton />;


  // Prochain objectif à venir (le plus proche dans le futur).
  const nextGoal = state.goals
    .filter((g) => g.date && (daysUntil(g.date) ?? -1) >= 0)
    .sort((a, b) => (daysUntil(a.date)! - daysUntil(b.date)!))[0];

  return (
    <div>
      {/* Pop-up de célébration : nouveau badge débloqué */}
      {celebrate.length > 0 && (() => {
        const ch = celebrate[0];
        const color = ch.color ?? "#a855f7";
        return (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-5"
            onClick={() => dismissCelebrated(ch.id)}
          >
            <div
              className="w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-surface text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-7 pb-6" style={{ background: `linear-gradient(160deg, ${color}, ${color}cc)` }}>
                <p className="text-sm font-semibold uppercase tracking-wider text-white/80">🎉 Badge débloqué</p>
                <div className="mx-auto mt-4 grid h-32 w-32 place-items-center overflow-hidden rounded-full text-7xl shadow-xl animate-[pop_0.4s_ease]" style={{ background: "rgba(255,255,255,0.22)" }}>
                  {ch.badgeImage ? (
                    <img src={ch.badgeImage} alt={ch.title} className="h-full w-full object-contain" />
                  ) : ch.icon}
                </div>
                <h3 className="mt-4 text-2xl font-bold text-white">{ch.title}</h3>
                {ch.description && <p className="mt-1 text-[13px] text-white/85">{ch.description}</p>}
              </div>
              <div className="p-5">
                <p className="text-[13px] text-dim">{conditionText(ch, library.exercises)}</p>
                <button
                  onClick={() => dismissCelebrated(ch.id)}
                  className="mt-4 w-full rounded-xl py-3 font-bold text-white"
                  style={{ background: color }}
                >
                  {celebrate.length > 1 ? `Génial ! (encore ${celebrate.length - 1})` : "Génial !"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bannière Vue d'ensemble (coach uniquement) — photo panoramique, même langage que les tuiles */}
      {isCoach && (
        <Link
          href="/overview"
          className={`relative isolate mb-3.5 flex h-[104px] items-center overflow-hidden rounded-[20px] text-white transition active:scale-[0.98] sm:h-[132px] ${
            coachUrgent > 0 ? "ring-2 ring-danger shadow-[0_8px_26px_-10px_rgba(239,83,80,0.8)]" : ""
          }`}
        >
          <Image
            src="/tiles/overview.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 720px, 100vw"
            className="-z-20 object-cover"
            style={{ objectPosition: "18% 55%" }}
          />
          {/* Voile : sombre à droite pour le texte, le phare reste lumineux à gauche */}
          <span
            aria-hidden
            className={`absolute inset-0 -z-10 ${
              coachUrgent > 0
                ? "bg-[linear-gradient(to_left,rgba(60,6,6,.9)_0%,rgba(60,6,6,.6)_45%,rgba(0,0,0,.05)_80%)]"
                : "bg-[linear-gradient(to_left,rgba(0,0,0,.82)_0%,rgba(0,0,0,.5)_45%,rgba(0,0,0,0)_80%)]"
            }`}
          />
          <span className="ml-auto flex flex-col items-end gap-1 px-4 text-right">
            <span className="text-[22px] font-black uppercase leading-[.95] tracking-[-0.02em] [text-shadow:0_2px_12px_rgba(0,0,0,.45)] sm:text-[28px]">
              Vue d&apos;ensemble
            </span>
            {coachUrgent > 0 ? (
              <span className="flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-0.5 text-[11.5px] font-black">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                {coachUrgent} message{coachUrgent > 1 ? "s" : ""} urgent{coachUrgent > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-[11.5px] font-bold text-white/90">Blessures &amp; objectifs de tous les sportifs ›</span>
            )}
          </span>
        </Link>
      )}

      {/* Bannière vacances (client uniquement, quand la période est active) */}
      {!isCoach && (() => {
        const vs = me?.vacation_start;
        const ve = me?.vacation_end;
        const onVacation = !!vs && today >= vs && (!ve || today <= ve);
        if (!onVacation) return null;
        const endDate = ve
          ? new Date(ve + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
          : null;
        return (
          <div className="mb-3.5 flex items-center gap-3 rounded-2xl border border-orange-500/40 bg-orange-500/5 px-4 py-3">
            <span className="text-2xl">🏖️</span>
            <div>
              <p className="font-semibold text-orange-400">Tu es en vacances</p>
              <p className="text-[12px] text-dim">
                {endDate ? `Jusqu'au ${endDate} · Bon repos !` : "Profite bien !"}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Grille de tuiles photo — 2 colonnes sur mobile, 3 dès 640 px */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CARDS.map((c) => {
          const isProfile = c.href === "/profile";
          // Tuile Profil : la photo du sportif s'il en a une, sinon la photo par défaut.
          const ownPhoto = isProfile ? state.profile.photo : "";
          const title = isProfile ? displayName : c.title;
          const subtitle = isProfile
            ? "Mon profil"
            : c.href === "/goals"
              ? (nextGoal ? `${countdownLabel(nextGoal.date)} · ${nextGoal.competition}` : null)
              : cardSubtitle(getCardInfo(c.href, state, library, today));
          return (
            <Link
              key={c.href}
              href={c.href}
              className="@container relative isolate block aspect-square overflow-hidden rounded-[20px] bg-surface2 text-white transition active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {ownPhoto ? (
                // Photo de profil (Supabase ou base64 historique) : <img> simple, next/image
                // exigerait de déclarer le domaine distant.
                <img src={ownPhoto} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
              ) : (
                <Image
                  src={c.img}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 250px, 50vw"
                  className="-z-20 object-cover"
                  style={{ objectPosition: c.pos }}
                />
              )}
              {/* Voile dégradé : garantit la lisibilité du titre quelle que soit la photo */}
              <span
                aria-hidden
                className={`absolute inset-0 -z-10 ${
                  c.strong
                    ? "bg-[linear-gradient(to_top,rgba(0,0,0,.88)_0%,rgba(0,0,0,.5)_55%,rgba(0,0,0,.25)_100%)]"
                    : "bg-[linear-gradient(to_top,rgba(0,0,0,.82)_0%,rgba(0,0,0,.35)_45%,rgba(0,0,0,.05)_75%)]"
                }`}
              />

              {c.href === "/followup" && unreadMessages > 0 && (
                <span className="absolute right-3 top-3 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-danger px-1.5 text-xs font-black shadow-[0_2px_8px_rgba(0,0,0,.4)]">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}

              {/* Titre dimensionné sur la LARGEUR DE LA TUILE (cqi), pas sur l'écran : réglé pour
                  que « PROGRAMMATION », le mot le plus long, tienne sans coupure de 320 à 1024 px. */}
              <span className="absolute inset-x-0 bottom-0 flex flex-col gap-[3px] p-[6cqi]">
                <span className="text-[9.3cqi] font-black uppercase leading-[.92] tracking-[-0.02em] [overflow-wrap:break-word] [text-shadow:0_2px_12px_rgba(0,0,0,.45)] [text-wrap:balance]">
                  {title}
                </span>
                {subtitle && (
                  <span className="truncate text-[11.5px] font-bold text-white/90">{subtitle}</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
