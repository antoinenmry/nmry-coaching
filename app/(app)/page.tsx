"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useData } from "@/components/DataProvider";
import { daysUntil, countdownLabel } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import type { AppState, ExerciseLibrary } from "@/lib/types";

const CARDS = [
  { href: "/profile", icon: "👤", label: "Mon Profil", color: "var(--color-accent)" },
  { href: "/plan", icon: "🗓️", label: "Programmation", color: "var(--color-accent2)" },
  { href: "/goals", icon: "🎯", label: "Mes Objectifs", color: "var(--color-ok)" },
  { href: "/records", icon: "🏆", label: "Mes Records", color: "var(--color-accent)" },
  { href: "/followup", icon: "📝", label: "Mon Suivi", color: "var(--color-danger)" },
  { href: "/library", icon: "📚", label: "Ma Bibliothèque", color: "var(--color-accent)" },
];

// Emojis proposés dans le picker par carte (admin)
const CARD_EMOJIS: Record<string, string[]> = {
  "/profile":  ["👤","🧑","🙋","🏃","💪","⚡","🔥","🌟"],
  "/plan":     ["🗓️","📅","📋","🏋️","⏱️","📌","🎽","🚀"],
  "/goals":    ["🎯","🏅","🥇","🏆","⭐","🌠","🎖️","🎪"],
  "/records":  ["🏆","📈","💯","🔝","⚡","🥊","🏋️","💥"],
  "/followup": ["📝","💬","🩺","❤️","📊","🧘","🌡️","📓"],
  "/library":  ["📚","🗂️","💡","🔍","🧠","📖","🏗️","🎓"],
};

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

function renderIcon(
  href: string,
  defaultIcon: string,
  cardIcons: Record<string, string>,
  profilePhoto: string,
) {
  const custom = cardIcons[href];
  if (custom) {
    return custom.startsWith("http") ? (
      <img src={custom} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover border border-line" />
    ) : (
      <span className="text-3xl">{custom}</span>
    );
  }
  if (href === "/profile" && profilePhoto) {
    return <img src={profilePhoto} alt="avatar" className="h-10 w-10 shrink-0 rounded-full object-cover border border-line" />;
  }
  return <span className="text-3xl">{defaultIcon}</span>;
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Placeholder bannière Vue d'ensemble */}
      <div className="mb-3.5 h-[72px] rounded-2xl bg-surface2" />
      {/* Grille 2×3 */}
      <div className="grid grid-cols-2 gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-surface2" />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { me, state, library, loading, role, updateLibrary } = useData();
  const today = new Date().toISOString().slice(0, 10);
  const isCoach = role === "coach" || role === "admin";
  const displayName = state.profile.name || me?.name || me?.email || "Moi";

  // Messages non lus + urgents — source unique de vérité : table chat_messages via API
  // (coach = total tous sportifs ; sportif = sa conversation). Remplace l'ancienne lecture
  // de app_state.data.messages, obsolète depuis la migration du chat.
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [coachUrgent, setCoachUrgent] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [pickerCard, setPickerCard] = useState<string | null>(null);
  const [pickerValue, setPickerValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  if (loading) return <DashboardSkeleton />;

  const isAdmin = role === "admin";
  const cardIcons = library.cardIcons ?? {};

  const applyIcon = () => {
    const card = pickerCard;
    const value = pickerValue;
    if (!card || !value) return;
    updateLibrary((lib) => {
      if (!lib.cardIcons) lib.cardIcons = {};
      lib.cardIcons[card] = value;
    });
    setPickerCard(null);
  };

  const resetIcon = () => {
    const card = pickerCard;
    if (!card) return;
    updateLibrary((lib) => {
      if (lib.cardIcons) delete lib.cardIcons[card];
    });
    setPickerCard(null);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const card = pickerCard;
    const file = e.target.files?.[0];
    if (!file || !card) return;
    setUploading(true);
    try {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.src = objUrl;
      await new Promise<void>((r) => { img.onload = () => r(); });
      const size = 80;
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      canvas.getContext("2d")!.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(objUrl);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
      if (!blob) return;
      const slug = card.replace(/\//g, "");
      const path = `card-icons/${slug}.jpg`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("badges").upload(path, blob, {
        contentType: "image/jpeg", upsert: true, cacheControl: "31536000",
      });
      if (error) throw error;
      const uploadedUrl = supabase.storage.from("badges").getPublicUrl(path).data.publicUrl;
      setPickerValue(uploadedUrl);
    } catch {
      // silent — user can retry
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const cardColors = state.preferences?.cardColors ?? {};
  const cardColorMode = state.preferences?.cardColorMode ?? "full";

  // Prochain objectif à venir (le plus proche dans le futur).
  const nextGoal = state.goals
    .filter((g) => g.date && (daysUntil(g.date) ?? -1) >= 0)
    .sort((a, b) => (daysUntil(a.date)! - daysUntil(b.date)!))[0];

  return (
    <div>
      {/* Carte Vue d'ensemble (coach uniquement) */}
      {isCoach && (
        <Link
          href="/overview"
          className={`relative mb-3.5 flex items-center gap-3 overflow-hidden rounded-2xl border p-4 transition active:scale-95 ${
            coachUrgent > 0
              ? "border-danger/50 bg-danger/5"
              : "border-line bg-surface"
          }`}
        >
          <span className="absolute inset-0 opacity-10" style={{ background: coachUrgent > 0 ? "#ef4444" : "#a855f7" }} />
          <div className="relative shrink-0">
            <span className="text-3xl">{coachUrgent > 0 ? "🚨" : "👁️"}</span>
            {coachUrgent > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                {coachUrgent > 9 ? "9+" : coachUrgent}
              </span>
            )}
          </div>
          <div>
            <p className={`font-semibold ${coachUrgent > 0 ? "text-danger" : ""}`}>Vue d&apos;ensemble</p>
            <p className="text-[12px] text-dim">
              {coachUrgent > 0
                ? `${coachUrgent} message${coachUrgent > 1 ? "s" : ""} urgent${coachUrgent > 1 ? "s" : ""} non lu${coachUrgent > 1 ? "s" : ""}`
                : "Blessures & objectifs de tous les sportifs"}
            </p>
          </div>
          <span className="ml-auto text-dim">›</span>
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

      {/* Bouton admin — modifier les icônes */}
      {isAdmin && (
        <div className="mb-2 flex justify-end">
          <button
            onClick={() => { setEditMode(!editMode); if (editMode) setPickerCard(null); }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] transition ${
              editMode
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-line bg-surface text-dim"
            }`}
          >
            {editMode ? "✓ Terminer" : "✏️ Icônes"}
          </button>
        </div>
      )}

      {/* Grille de cartes */}
      <div className="grid grid-cols-2 gap-3.5">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            onClick={(e) => {
              if (editMode) {
                e.preventDefault();
                setPickerCard(c.href);
                setPickerValue(cardIcons[c.href] ?? "");
              }
            }}
            className={`relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border bg-surface p-4 transition active:scale-95 ${
              editMode ? "border-dashed border-accent/60" : "border-line"
            }`}
          >
            {cardColorMode === "full" ? (
              <span className="absolute inset-0 opacity-20" style={{ background: cardColors[c.href] || c.color }} />
            ) : (
              <span className="absolute -right-7 -top-7 h-[90px] w-[90px] rounded-full opacity-15" style={{ background: cardColors[c.href] || c.color }} />
            )}
           <div className="flex items-start justify-between">
                 {renderIcon(c.href, c.icon, cardIcons, state.profile.photo)}
{/* Badge crayon en mode édition */}
{editMode && (
  <div className="pointer-events-none absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-accent">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  </div>
)}
{/* Badge messages non lus sur Mon Suivi */}
{c.href === "/followup" && unreadMessages > 0 && (
  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
    {unreadMessages > 9 ? "9+" : unreadMessages}
  </span>
)}
  
{/* Overlay Objectifs : J-X, nom, lieu */}
  {c.href === "/goals" && nextGoal && (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
      <span className="text-2xl font-black text-ok">
        {countdownLabel(nextGoal.date)}
      </span>
      <span className="mt-1 text-xs font-bold truncate w-full px-1">
        {nextGoal.competition}
      </span>
      {nextGoal.place && (
        <span className="mt-0.5 text-[11px] text-dim truncate w-full px-1">
          📍 {nextGoal.place}
        </span>
      )}
    </div>
  )}
  {/* Overlay info dynamique : même style que Objectifs */}
  {c.href !== "/profile" && c.href !== "/goals" && (() => {
    const info = getCardInfo(c.href, state, library, today);
    if (!info) return null;
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
        <span className={info.big
          ? "text-3xl font-black leading-none"
          : "text-sm font-bold leading-snug line-clamp-3 px-1"
        }>
          {info.main}
        </span>
        <span className="mt-1.5 text-[11px] text-dim leading-tight px-1">{info.sub}</span>
      </div>
    );
  })()}
</div>
            
            {/* Label (visible quand pas d'overlay) */}
            <div className="mt-2 font-semibold text-lg truncate w-full">
              {c.href === "/profile" ? displayName : c.label}
            </div>
          </Link>
        ))}
      </div>

      {/* Picker icône (admin) */}
      {pickerCard && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setPickerCard(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-dim">
              Icône — {CARDS.find((c) => c.href === pickerCard)?.label}
            </p>
            <div className="mb-4 grid grid-cols-8 gap-1.5">
              {(CARD_EMOJIS[pickerCard] ?? []).map((e) => (
                <button
                  key={e}
                  onClick={() => setPickerValue(e)}
                  className={`flex h-10 w-full items-center justify-center rounded-xl text-2xl transition ${
                    pickerValue === e ? "bg-accent/20 ring-1 ring-accent" : "bg-surface2"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>

            <div className="relative my-3 flex items-center">
              <div className="flex-1 border-t border-line" />
              <span className="mx-2 text-[11px] text-dim">ou image personnalisée</span>
              <div className="flex-1 border-t border-line" />
            </div>

            <div className="mb-4 flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2 text-[13px] text-dim disabled:opacity-50"
              >
                {uploading ? "Upload…" : "📁 Uploader"}
              </button>
              {pickerValue.startsWith("http") && (
                <img src={pickerValue} alt="" className="h-10 w-10 rounded-full object-cover border border-line" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />

            <div className="flex gap-2">
              <button
                onClick={resetIcon}
                className="flex-1 rounded-xl border border-line py-2.5 text-[13px] text-dim"
              >
                Par défaut
              </button>
              <button
                onClick={applyIcon}
                disabled={!pickerValue}
                className="flex-1 rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
