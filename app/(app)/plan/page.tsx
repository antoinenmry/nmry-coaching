"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "@/components/DataProvider";
import SessionEditor from "@/components/SessionEditor";
import ExerciseMultiSelect from "@/components/ExerciseMultiSelect";
import GoalInfoModal from "@/components/GoalInfoModal";
import { AUTH_ENABLED } from "@/lib/config";
import { SESSION_COLORS, newSession, exerciseInstanceFromLibrary } from "@/lib/data";
import { countdownLabel } from "@/lib/dates";
import type { AppState, Followup, Goal, SessionInstance } from "@/lib/types";
import { emptyState } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DOW = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shortName = (n: string) => n.split("(")[0].trim();
const EMOJIS = ["😫", "😕", "😐", "🙂", "🤩"];
const emojiOf = (n: number) => (n >= 1 && n <= 5 ? EMOJIS[n - 1] + " " : "");

export default function PlanPage() {
  const { state, update, role, setRole, loading, clients, activeUserId, me } = useData();
  const isCoach = role === "coach" || role === "admin";

  const [mode, setMode] = useState<"month" | "week" | "synthesis">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [pending, setPending] = useState<string | null>(null); // séance à placer (tap-to-place)
  const [editing, setEditing] = useState<string | null>(null); // sessionId
  const [composing, setComposing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [viewingGoals, setViewingGoals] = useState<Goal[] | null>(null);
  // Objectifs des autres sportifs (coach uniquement)
  const [otherGoals, setOtherGoals] = useState<Goal[]>([]);

  const todayKey = ymd(new Date());

  // Charger les objectifs de tous les sportifs — uniquement quand le coach consulte SON propre profil
  useEffect(() => {
    if (!isCoach || loading || activeUserId !== me?.id) { setOtherGoals([]); return; }
    const supabase = createClient();
    const otherClients = clients.filter((c) => c.role === "client" && c.id !== activeUserId);
    if (otherClients.length === 0) { setOtherGoals([]); return; }
    (async () => {
      const { data: rows } = await supabase
        .from("app_state")
        .select("user_id,data")
        .in("user_id", otherClients.map((c) => c.id));
      const goals: Goal[] = (rows ?? []).flatMap((row) => {
        const profile = otherClients.find((c) => c.id === row.user_id);
        const name = profile?.name || profile?.email || "Sportif";
        const s: AppState = { ...emptyState(), ...(row.data ?? {}) };
        return (s.goals ?? []).map((g) => ({ ...g, clientName: name }));
      });
      setOtherGoals(goals);
    })();
  }, [isCoach, loading, clients, activeUserId]);

  const bank = useMemo(() => state.sessions.filter((s) => !s.date), [state.sessions]);
  const sessionsByDate = useMemo(() => {
    const m: Record<string, SessionInstance[]> = {};
    state.sessions.forEach((s) => {
      if (s.date) (m[s.date] ??= []).push(s);
    });
    return m;
  }, [state.sessions]);

  const goalsByDate = useMemo(() => {
    const m: Record<string, Goal[]> = {};
    // Objectifs du sportif actif
    state.goals.forEach((g) => {
      if (g.date) (m[g.date] ??= []).push(g);
    });
    // Objectifs des autres sportifs (coach uniquement)
    otherGoals.forEach((g) => {
      if (g.date) (m[g.date] ??= []).push(g);
    });
    return m;
  }, [state.goals, otherGoals]);

  const injuries = useMemo(
    () => state.followups.filter((f) => f.type === "injury"),
    [state.followups],
  );

  function shiftPeriod(dir: number) {
    const d = new Date(cursor);
    if (mode === "month") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setCursor(d);
  }

  function place(sessionId: string, date: string | null) {
    update((d) => {
      const s = d.sessions.find((x) => x.id === sessionId);
      if (s) s.date = date;
    });
    setPending(null);
  }

  function deleteBankSession(sessionId: string) {
    update((d) => {
      d.sessions = d.sessions.filter((x) => x.id !== sessionId);
    });
  }

  if (loading) return <p className="py-10 text-center text-dim">Chargement…</p>;

  return (
    <div>
      {/* Bascule de rôle (mode local ou invité) */}
      {!AUTH_ENABLED && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
          <span className="text-[13px] text-dim">Vue :</span>
          <div className="flex rounded-lg bg-surface2 p-1">
            {(["coach", "client"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-semibold ${
                  role === r ? "bg-accent text-[#1a1500]" : "text-dim"
                }`}
              >
                {r === "coach" ? "Coach" : "Sportif"}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[11px] text-dim">
            {isCoach ? "Crée et édite les séances" : "Place les séances et donne ton ressenti"}
          </span>
        </div>
      )}

      {/* Barre d'outils */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-surface2 p-1">
          {(["month", "week", "synthesis"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3.5 py-2 text-sm font-semibold ${mode === m ? "bg-accent text-[#1a1500]" : "text-dim"}`}
            >
              {m === "month" ? "Mois" : m === "week" ? "Semaine" : "Synthèse"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <button onClick={() => shiftPeriod(-1)} className="h-9 w-9 rounded-lg bg-surface2 text-lg">‹</button>
          <span className="min-w-[130px] text-center text-sm font-bold">{periodLabel(mode, cursor)}</span>
          <button onClick={() => shiftPeriod(1)} className="h-9 w-9 rounded-lg bg-surface2 text-lg">›</button>
        </div>
      </div>

      {/* Zone "À placer" */}
      <div
        className="mb-3.5 rounded-xl border border-line bg-surface p-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData("text/session");
          if (id) place(id, null);
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold">À placer ({bank.length})</span>
          {isCoach && (
            <div className="flex gap-2">
              <button onClick={() => setComposing(true)} className="rounded-lg bg-ok px-3 py-1.5 text-[13px] font-semibold text-[#06210a]">
                + Créer une séance
              </button>
              <button onClick={() => setDuplicating(true)} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white" style={{ background: "#a855f7" }}>
                Dupliquer la semaine
              </button>
            </div>
          )}
        </div>
        {bank.length === 0 ? (
          <p className="py-2 text-[13px] text-dim">
            {isCoach ? "Crée des séances ; elles apparaîtront ici à placer sur les jours." : "Aucune séance à placer pour l'instant."}
          </p>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {bank.map((s) => (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/session", s.id)}
                onClick={() => setPending(pending === s.id ? null : s.id)}
                className={`flex-none cursor-grab select-none rounded-xl border bg-surface2 px-3 py-2.5 ${
                  pending === s.id ? "border-accent" : "border-line"
                }`}
                style={{ borderLeft: `5px solid ${s.color}` }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{s.name}</span>
                  {isCoach && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setEditing(s.id); }} className="rounded bg-surface px-1.5 text-[12px]">✏️</button>
                      <button onClick={(e) => { e.stopPropagation(); deleteBankSession(s.id); }} className="rounded bg-surface px-1.5 text-[12px]">🗑️</button>
                    </>
                  )}
                </div>
                <span className="text-[11px] text-dim">{s.exercises.length} exercice{s.exercises.length > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mb-2.5 text-xs text-dim">
        {pending ? "Touche un jour pour y placer la séance sélectionnée." : "Glisse une séance sur un jour (ou touche-la puis touche le jour)."}
      </p>

      {/* Calendrier */}
      {mode === "month" ? (
        <MonthView
          cursor={cursor}
          todayKey={todayKey}
          sessionsByDate={sessionsByDate}
          goalsByDate={goalsByDate}
          injuries={injuries}
          pending={pending}
          onPlace={place}
          onOpen={setEditing}
          onOpenGoal={setViewingGoals}
        />
      ) : mode === "week" ? (
        <WeekView
          cursor={cursor}
          todayKey={todayKey}
          sessionsByDate={sessionsByDate}
          goalsByDate={goalsByDate}
          injuries={injuries}
          pending={pending}
          onPlace={place}
          onOpen={setEditing}
          onOpenGoal={setViewingGoals}
        />
      ) : (
        <SynthesisView
          cursor={cursor}
          todayKey={todayKey}
          sessionsByDate={sessionsByDate}
          goalsByDate={goalsByDate}
          injuries={injuries}
          onOpen={setEditing}
          onOpenGoal={setViewingGoals}
        />
      )}

      <div className="mt-3 flex flex-col gap-1">
        {state.goals.some((g) => g.date) && (
          <p className="flex items-center gap-1.5 text-xs text-dim">
            <span className="inline-block h-3 w-3 rounded border border-ok bg-ok/20" /> 🎯 Jour de compétition
          </p>
        )}
        {injuries.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-dim">
            <span className="inline-block h-3 w-3 rounded border border-danger bg-danger/20" /> 🩹 Blessure active
          </p>
        )}
      </div>

      {editing && <SessionEditor sessionId={editing} role={role} onClose={() => setEditing(null)} />}

      {viewingGoals && <GoalInfoModal goals={viewingGoals} onClose={() => setViewingGoals(null)} />}

      {composing && (
        <ComposeModal
          onClose={() => setComposing(false)}
          onCreated={(id) => { setComposing(false); setEditing(id); }}
        />
      )}

      {duplicating && (
        <DuplicateWeekModal
          cursor={cursor}
          sessionsByDate={sessionsByDate}
          onClose={() => setDuplicating(false)}
        />
      )}
    </div>
  );
}

// Modale de création d'une séance (coach) : nom + couleur + exercices → dans la banque.
// Exercice sélectionné (bibliothèque ou inline) dans ComposeModal.
interface SelectedEx {
  id: string;
  name: string;
  isInline: boolean;
  tags: Record<string, string[]>;
  video: string;
}

function ComposeModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { update, updateLibrary, library } = useData();
  const { categories } = library;

  // --- état principal ---
  const [name, setName] = useState("");
  const [color, setColor] = useState(SESSION_COLORS[0]);
  // Liste unifiée et ordonnée (biblio + custom)
  const [exercises, setExercises] = useState<SelectedEx[]>([]);
  const [saveToLib, setSaveToLib] = useState(true);
  // Filtres visibles/masqués
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Formulaire exercice custom
  const [newName, setNewName] = useState("");
  const [newTags, setNewTags] = useState<Record<string, string[]>>({});
  const [newVideo, setNewVideo] = useState("");
  const [showTagsForm, setShowTagsForm] = useState(false);
  // Backdrop — évite la fermeture lors de la sélection de texte
  const backdropDown = useRef(false);

  // Toggle exercice bibliothèque
  function toggleLibEx(id: string) {
    setExercises((prev) => {
      if (prev.find((e) => e.id === id)) return prev.filter((e) => e.id !== id);
      const libEx = library.exercises.find((e) => e.id === id);
      return [...prev, { id, name: libEx?.name ?? id, isInline: false, tags: {}, video: "" }];
    });
  }

  // Toggle tag dans le formulaire custom
  const toggleTag = (catId: string, optId: string) =>
    setNewTags((prev) => {
      const cur = prev[catId] ?? [];
      return { ...prev, [catId]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] };
    });

  // Ajouter l'exercice custom à la liste
  function addInline() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setExercises((prev) => [...prev, { id: crypto.randomUUID(), name: trimmed, isInline: true, tags: newTags, video: newVideo }]);
    setNewName("");
    setNewTags({});
    setNewVideo("");
    setShowTagsForm(false);
  }

  // Réordonner
  function moveEx(index: number, dir: -1 | 1) {
    setExercises((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function create() {
    // 1. Sauvegarder les customs dans la bibliothèque partagée
    const customs = exercises.filter((e) => e.isInline);
    if (saveToLib && customs.length > 0) {
      updateLibrary((lib) => {
        customs.forEach(({ id, name: exName, tags, video }) => {
          if (!lib.exercises.find((e) => e.id === id)) {
            lib.exercises.push({ id, name: exName, tags, video, comment: "" });
          }
        });
      });
    }

    // 2. Construire la séance AVANT update() pour que l'ID soit garanti synchrone
    const s = newSession(name.trim() || "Séance", color);
    exercises.forEach(({ id, name: exName }) => {
      // La bibliothèque peut déjà inclure l'exercice custom (ajouté ci-dessus)
      // Utiliser le nom inline en fallback si l'exercice n'est pas encore dans library
      const libEx = library.exercises.find((e) => e.id === id);
      s.exercises.push(exerciseInstanceFromLibrary({ id, name: libEx?.name ?? exName }));
    });

    update((d) => { d.sessions.push(s); });
    onCreated(s.id);
  }

  const pickedIds = exercises.filter((e) => !e.isInline).map((e) => e.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onPointerDown={(e) => { backdropDown.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (backdropDown.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        {/* En-tête */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Nouvelle séance</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>

        {/* Nom */}
        <label className="mb-3 block">
          <span className="mb-1 block text-[13px] text-dim">Nom de la séance</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Haut du corps A" autoFocus />
        </label>

        {/* Couleur */}
        <div className="mb-3">
          <span className="mb-1.5 block text-[13px] text-dim">Couleur</span>
          <div className="flex gap-2">
            {SESSION_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-ink" : "border-transparent"}`} style={{ background: c }} aria-label={`Couleur ${c}`} />
            ))}
          </div>
        </div>

        {/* Bibliothèque : en-tête + toggle filtres */}
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[13px] text-dim">
            Bibliothèque ({pickedIds.length} sélectionné{pickedIds.length > 1 ? "s" : ""})
          </span>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="rounded-lg bg-surface2 px-2.5 py-1 text-[12px] font-medium text-dim hover:text-ink"
          >
            {filtersOpen ? "▲ Masquer les filtres" : "▼ Filtres"}
          </button>
        </div>
        <ExerciseMultiSelect picked={pickedIds} onToggle={toggleLibEx} showFilters={filtersOpen} />

        {/* Exercice personnalisé */}
        <div className="mt-4 rounded-xl border border-dashed border-line bg-surface2 p-3">
          <p className="mb-2 text-[13px] font-semibold text-dim">Nouvel exercice personnalisé</p>

          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) { e.preventDefault(); setShowTagsForm(true); } }}
              placeholder="Nom de l'exercice…"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => { if (newName.trim()) setShowTagsForm(true); }}
              disabled={!newName.trim()}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-[#1a1500] disabled:opacity-40"
            >
              Détails →
            </button>
          </div>

          {/* Formulaire étendu tags + vidéo */}
          {showTagsForm && newName.trim() && (
            <div className="mt-3 space-y-2.5 border-t border-line/50 pt-3">
              {categories.map((cat) => (
                <div key={cat.id}>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-dim">{cat.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.options.map((opt) => {
                      const active = (newTags[cat.id] ?? []).includes(opt.id);
                      return (
                        <button key={opt.id} type="button" onClick={() => toggleTag(cat.id, opt.id)}
                          className={`rounded-full border px-2.5 py-1 text-[12px] transition ${active ? "border-accent bg-accent/15 text-accent" : "border-line bg-surface text-ink"}`}>
                          {opt.label}
                        </button>
                      );
                    })}
                    {cat.options.length === 0 && <span className="text-[12px] text-dim">—</span>}
                  </div>
                </div>
              ))}
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wide text-dim">Lien vidéo (optionnel)</p>
                <input value={newVideo} onChange={(e) => setNewVideo(e.target.value)} placeholder="https://…" className="text-sm" />
              </div>
              <button type="button" onClick={addInline}
                className="w-full rounded-lg bg-ok py-2 text-sm font-semibold text-[#06210a]">
                ✓ Ajouter « {newName.trim()} »
              </button>
            </div>
          )}
        </div>

        {/* Récapitulatif ordonné — tous les exercices sélectionnés */}
        {exercises.length > 0 && (
          <div className="mt-4 rounded-xl border border-line bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-dim">
                Récapitulatif · {exercises.length} exercice{exercises.length > 1 ? "s" : ""}
              </p>
              {exercises.some((e) => e.isInline) && (
                <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-dim">
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] font-bold transition ${saveToLib ? "border-ok bg-ok text-[#06210a]" : "border-line bg-surface"}`}
                    onClick={() => setSaveToLib((v) => !v)}
                  >
                    {saveToLib ? "✓" : ""}
                  </span>
                  <input type="checkbox" className="sr-only" checked={saveToLib} onChange={(e) => setSaveToLib(e.target.checked)} />
                  Sauver customs en bibliothèque
                </label>
              )}
            </div>
            <ol className="space-y-1">
              {exercises.map((ex, i) => {
                const labels = categories.flatMap((c) =>
                  (ex.tags[c.id] ?? []).map((tid) => c.options.find((o) => o.id === tid)?.label).filter(Boolean) as string[]
                );
                return (
                  <li key={ex.id} className="flex items-center gap-2 rounded-lg bg-surface2 px-2.5 py-1.5 text-sm">
                    <span className="w-5 shrink-0 text-center text-[11px] text-dim font-bold">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{ex.name}</span>
                      {ex.isInline && <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">custom</span>}
                      {labels.length > 0 && <span className="ml-2 text-[11px] text-dim">{labels.join(", ")}</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button type="button" onClick={() => moveEx(i, -1)} disabled={i === 0}
                        className="grid h-7 w-7 place-items-center rounded text-dim disabled:opacity-20 hover:text-ink" aria-label="Monter">▲</button>
                      <button type="button" onClick={() => moveEx(i, 1)} disabled={i === exercises.length - 1}
                        className="grid h-7 w-7 place-items-center rounded text-dim disabled:opacity-20 hover:text-ink" aria-label="Descendre">▼</button>
                      <button type="button" onClick={() => setExercises((p) => p.filter((e) => e.id !== ex.id))}
                        className="grid h-7 w-7 place-items-center rounded text-dim hover:text-danger" aria-label="Retirer">✕</button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <button
          onClick={create}
          className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500]"
        >
          Créer la séance{exercises.length > 0 ? ` (${exercises.length} exercice${exercises.length > 1 ? "s" : ""})` : ""}
        </button>
      </div>
    </div>
  );
}

function getMonday(d: Date) {
  const m = new Date(d);
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  m.setHours(0, 0, 0, 0);
  return m;
}

function weekLabel(monday: Date) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.getDate()} ${MONTHS[monday.getMonth()].slice(0, 3)} – ${sunday.getDate()} ${MONTHS[sunday.getMonth()].slice(0, 3)} ${sunday.getFullYear()}`;
}

function DuplicateWeekModal({
  cursor,
  sessionsByDate,
  onClose,
}: {
  cursor: Date;
  sessionsByDate: Record<string, SessionInstance[]>;
  onClose: () => void;
}) {
  const { update } = useData();
  const [sourceMonday, setSourceMonday] = useState(() => getMonday(cursor));
  const [numWeeks, setNumWeeks] = useState(1);

  // Séances placées dans la semaine source
  const sourceSessions = useMemo(() => {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sourceMonday);
      d.setDate(sourceMonday.getDate() + i);
      days.push(ymd(d));
    }
    return days.flatMap((day) => (sessionsByDate[day] ?? []).map((s) => ({ ...s, sourceDay: day })));
  }, [sourceMonday, sessionsByDate]);

  function shiftSource(dir: number) {
    setSourceMonday((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + dir * 7);
      return next;
    });
  }

  function duplicate() {
    update((d) => {
      for (let week = 1; week <= numWeeks; week++) {
        sourceSessions.forEach(({ sourceDay, ...session }) => {
          const srcDate = new Date(sourceDay);
          const targetDate = new Date(srcDate);
          targetDate.setDate(srcDate.getDate() + week * 7);
          const copy: SessionInstance = {
            ...structuredClone(session),
            id: crypto.randomUUID(),
            date: ymd(targetDate),
            done: false,
            emoji: 0,
            coachComment: session.coachComment,
            exercises: session.exercises.map((ex) => ({
              ...structuredClone(ex),
              uid: crypto.randomUUID(),
              rpeClient: 0,
              clientComment: "",
            })),
          };
          d.sessions.push(copy);
        });
      }
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Dupliquer la semaine</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>

        {/* Sélecteur de semaine source */}
        <p className="mb-1.5 text-[13px] text-dim">Semaine à dupliquer</p>
        <div className="mb-1 flex items-center gap-2">
          <button onClick={() => shiftSource(-1)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface2 text-lg">‹</button>
          <span className="flex-1 text-center text-sm font-semibold">{weekLabel(sourceMonday)}</span>
          <button onClick={() => shiftSource(1)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface2 text-lg">›</button>
        </div>
        <p className="mb-4 text-center text-[13px] text-dim">
          {sourceSessions.length === 0
            ? "Aucune séance placée cette semaine"
            : `${sourceSessions.length} séance${sourceSessions.length > 1 ? "s" : ""} à copier`}
        </p>

        {/* Nombre de semaines */}
        <p className="mb-2 text-[13px] text-dim">Sur combien de semaines suivantes ?</p>
        <div className="mb-5 flex items-center justify-center gap-4">
          <button
            onClick={() => setNumWeeks((n) => Math.max(1, n - 1))}
            className="grid h-10 w-10 place-items-center rounded-xl bg-surface2 text-xl font-bold"
          >−</button>
          <span className="w-12 text-center text-2xl font-extrabold">{numWeeks}</span>
          <button
            onClick={() => setNumWeeks((n) => Math.min(12, n + 1))}
            className="grid h-10 w-10 place-items-center rounded-xl bg-surface2 text-xl font-bold"
          >+</button>
        </div>

        <button
          onClick={duplicate}
          disabled={sourceSessions.length === 0}
          className="w-full rounded-xl py-3 font-semibold text-white disabled:opacity-40"
          style={{ background: "#a855f7" }}
        >
          Dupliquer sur {numWeeks} semaine{numWeeks > 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}

function periodLabel(mode: "month" | "week" | "synthesis", cursor: Date) {
  if (mode === "month") return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const monday = new Date(cursor);
  monday.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.getDate()} ${MONTHS[monday.getMonth()].slice(0, 3)} – ${sunday.getDate()} ${MONTHS[sunday.getMonth()].slice(0, 3)}`;
}

interface ViewProps {
  cursor: Date;
  todayKey: string;
  sessionsByDate: Record<string, SessionInstance[]>;
  goalsByDate: Record<string, Goal[]>;
  injuries: Followup[];
  pending: string | null;
  onPlace: (sessionId: string, date: string | null) => void;
  onOpen: (sessionId: string) => void;
  onOpenGoal: (goals: Goal[]) => void;
}

const TODAY = ymd(new Date());

function injuriesForDate(key: string, injuries: Followup[]): Followup[] {
  return injuries.filter((f) => {
    if (f.date > key) return false;
    // Pas de date de fin → on colore jusqu'à aujourd'hui uniquement
    const end = f.dateEnd ?? TODAY;
    return end >= key;
  });
}

function dayDrop(key: string, pending: string | null, onPlace: ViewProps["onPlace"]) {
  return {
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/session");
      if (id) onPlace(id, key);
    },
    onClick: () => {
      if (pending) onPlace(pending, key);
    },
  };
}

function SessionPill({ s, onOpen, big, todayKey }: { s: SessionInstance; onOpen: (id: string) => void; big?: boolean; todayKey: string }) {
  const isPast = !!s.date && s.date < todayKey;
  const rpes = s.exercises.map((e) => e.rpeClient).filter((r) => r > 0);
  const avgRpe = rpes.length > 0 ? Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length) : 0;

  const badge = s.done
    ? <span className="shrink-0 leading-none">{big && avgRpe > 0 ? `✅ RPE ${avgRpe}${s.emoji > 0 ? " " + EMOJIS[s.emoji - 1] : ""}` : "✅"}</span>
    : isPast
    ? <span className="shrink-0 leading-none">❌</span>
    : null;

  return (
    <button
      draggable
      onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/session", s.id); }}
      onClick={(e) => { e.stopPropagation(); onOpen(s.id); }}
      className={`w-full rounded-md px-1.5 text-left font-semibold text-[#06121f] ${big ? "py-1.5 text-[13px]" : "py-1 text-[11px]"}`}
      style={{ background: s.color }}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="min-w-0 flex-1 truncate">{emojiOf(s.emoji)}{big ? s.name : shortName(s.name)}</span>
        {badge}
      </span>
    </button>
  );
}

function MonthView({ cursor, todayKey, sessionsByDate, goalsByDate, injuries, pending, onPlace, onOpen, onOpenGoal }: ViewProps) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();

  const cells: React.ReactNode[] = DOW.map((d) => (
    <div key={`dow-${d}`} className="py-1 text-center text-[11px] font-semibold text-dim">{d}</div>
  ));
  for (let i = 0; i < startOffset; i++) cells.push(<div key={`pad-${i}`} className="opacity-30" />);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    const key = ymd(date);
    const sessions = sessionsByDate[key] ?? [];
    const goals = goalsByDate[key] ?? [];
    const dayInjuries = injuriesForDate(key, injuries);
    const isGoal = goals.length > 0;
    const isInjury = dayInjuries.length > 0;
    cells.push(
      <div
        key={key}
        {...dayDrop(key, pending, onPlace)}
        className={`flex min-h-[78px] flex-col gap-1 rounded-lg border p-1 ${
          isGoal
            ? "border-ok bg-ok/10 ring-1 ring-ok/50"
            : isInjury
            ? "border-danger/40 bg-danger/5"
            : `bg-surface ${key === todayKey ? "border-accent" : "border-line"}`
        } ${pending ? "cursor-pointer" : ""}`}
      >
        <span className="flex items-center justify-between text-[11px] text-dim">
          {day}
          <span className="flex gap-0.5">
            {isInjury && <span title={dayInjuries.map((f) => f.text).join(", ")}>🩹</span>}
            {isGoal && <span title={goals.map((g) => g.competition).join(", ")}>🎯</span>}
          </span>
        </span>
        {goals.map((g) => (
          <button
            key={g.id}
            onClick={(e) => { e.stopPropagation(); onOpenGoal([g]); }}
            className="truncate rounded-md bg-ok/25 px-1.5 py-0.5 text-left text-[10px] font-semibold text-ok"
            title={g.clientName ? `${g.clientName} · ${g.competition}` : g.competition}
          >
            {g.clientName ? `${g.clientName.split(" ")[0]} · ${g.competition}` : g.competition}
          </button>
        ))}
        {sessions.map((s) => <SessionPill key={s.id} s={s} onOpen={onOpen} todayKey={todayKey} />)}
      </div>,
    );
  }

  return <div className="grid grid-cols-7 gap-1.5">{cells}</div>;
}

interface SynthesisViewProps {
  cursor: Date;
  todayKey: string;
  sessionsByDate: Record<string, SessionInstance[]>;
  goalsByDate: Record<string, Goal[]>;
  injuries: Followup[];
  onOpen: (sessionId: string) => void;
  onOpenGoal: (goals: Goal[]) => void;
}

function SynthesisView({ cursor, todayKey, sessionsByDate, goalsByDate, injuries, onOpen, onOpenGoal }: SynthesisViewProps) {
  const monday = new Date(cursor);
  monday.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));

  return (
    <div className="space-y-3">
      {Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const key = ymd(date);
        const sessions = sessionsByDate[key] ?? [];
        const goals = goalsByDate[key] ?? [];
        const dayInjuries = injuriesForDate(key, injuries);
        const isGoal = goals.length > 0;
        const isInjury = dayInjuries.length > 0;
        const isToday = key === todayKey;

        return (
          <div
            key={key}
            className={`rounded-xl border p-3 ${
              isGoal
                ? "border-ok bg-ok/10"
                : isInjury
                ? "border-danger/40 bg-danger/5"
                : `bg-surface ${isToday ? "border-accent" : "border-line"}`
            }`}
          >
            <h3 className="mb-2 flex justify-between text-sm font-semibold">
              {DOW[i]}
              <span className="font-normal text-dim">{date.getDate()} {MONTHS[date.getMonth()].slice(0, 3)}</span>
            </h3>

            {goals.map((g) => (
              <button
                key={g.id}
                onClick={() => onOpenGoal([g])}
                className="mb-1.5 flex w-full items-center gap-1.5 rounded-md bg-ok/20 px-2 py-1 text-left text-[13px] font-semibold text-ok"
              >
                🎯
                {g.clientName && <span className="font-bold text-accent">{g.clientName.split(" ")[0]}</span>}
                <span className={g.clientName ? "font-normal" : ""}>{g.competition}</span>
                {g.place && <span className="font-normal opacity-80">· {g.place}</span>}
                <span className="ml-auto text-[11px] opacity-80">{countdownLabel(g.date)}</span>
              </button>
            ))}

            {dayInjuries.map((f) => (
              <div key={f.id} className="mb-2 flex items-center gap-1.5 rounded-md bg-danger/15 px-2 py-1 text-[13px] font-semibold text-danger">
                🩹 {f.text.split("\n")[0].slice(0, 60)}
              </div>
            ))}

            {sessions.length === 0 ? (
              <span className="text-[13px] italic text-dim">Repos / rien de prévu</span>
            ) : (
              <div className="flex flex-col gap-3">
                {sessions.map((s) => {
                  const isPast = !!s.date && s.date < todayKey;
                  const rpes = s.exercises.map((e) => e.rpeClient).filter((r) => r > 0);
                  const avgRpe = rpes.length > 0 ? Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length) : 0;

                  return (
                    <div key={s.id} className="rounded-xl border border-line bg-surface2 overflow-hidden">
                      {/* En-tête séance */}
                      <button
                        onClick={() => onOpen(s.id)}
                        className="w-full px-3 py-2.5 text-left"
                        style={{ borderLeft: `5px solid ${s.color}` }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm">{emojiOf(s.emoji)}{s.name}</span>
                          <span className="flex items-center gap-1.5 text-[12px] shrink-0">
                            {s.done ? (
                              <span className="text-ok font-semibold">✅{avgRpe > 0 ? ` RPE ${avgRpe}` : ""}</span>
                            ) : isPast ? (
                              <span className="text-danger">❌</span>
                            ) : null}
                            <span className="text-dim text-[11px] underline underline-offset-2">éditer</span>
                          </span>
                        </div>
                        {s.coachComment && (
                          <p className="mt-1 text-[12px] text-dim leading-snug">{s.coachComment}</p>
                        )}
                      </button>

                      {/* Exercices */}
                      {s.exercises.length > 0 && (
                        <div className="border-t border-line divide-y divide-line">
                          {s.exercises.map((ex) => {
                            const prescription = [
                              ex.sets ? `${ex.setsLabel ?? ex.sets} × ${(ex.repsLabel ?? ex.reps) || "?"}` : null,
                              ex.weight ? `${ex.weight} kg` : null,
                              ex.rpeCoach ? `RPE coach ${ex.rpeCoach}` : null,
                            ].filter(Boolean).join(" · ");

                            return (
                              <div key={ex.uid} className="px-3 py-2">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-[13px] font-medium">{ex.name}</span>
                                  {ex.failed ? (
                                    <span className="shrink-0 text-[11px] font-semibold text-danger">❌ Raté</span>
                                  ) : ex.rpeClient > 0 ? (
                                    <span className="shrink-0 text-[11px] font-semibold text-accent">
                                      RPE client {ex.rpeClient}
                                    </span>
                                  ) : null}
                                </div>
                                {prescription && (
                                  <p className="mt-0.5 text-[12px] text-dim">{prescription}</p>
                                )}
                                {ex.coachComment && (
                                  <p className="mt-1 text-[11px] text-dim italic">🗒 {ex.coachComment}</p>
                                )}
                                {ex.clientComment && (
                                  <p className="mt-1 text-[11px] text-accent2 italic">💬 {ex.clientComment}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WeekView({ cursor, todayKey, sessionsByDate, goalsByDate, injuries, pending, onPlace, onOpen, onOpenGoal }: ViewProps) {
  const monday = new Date(cursor);
  monday.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));

  return (
    <div className="space-y-2.5">
      {Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const key = ymd(date);
        const sessions = sessionsByDate[key] ?? [];
        const goals = goalsByDate[key] ?? [];
        const dayInjuries = injuriesForDate(key, injuries);
        const isGoal = goals.length > 0;
        const isInjury = dayInjuries.length > 0;
        return (
          <div
            key={key}
            {...dayDrop(key, pending, onPlace)}
            className={`rounded-xl border p-3 ${
              isGoal
                ? "border-ok bg-ok/10"
                : isInjury
                ? "border-danger/40 bg-danger/5"
                : `bg-surface ${key === todayKey ? "border-accent" : "border-line"}`
            } ${pending ? "cursor-pointer" : ""}`}
          >
            <h3 className="mb-2 flex justify-between text-sm font-semibold">
              {DOW[i]}
              <span className="font-normal text-dim">{date.getDate()} {MONTHS[date.getMonth()].slice(0, 3)}</span>
            </h3>
            {goals.map((g) => (
              <button
                key={g.id}
                onClick={(e) => { e.stopPropagation(); onOpenGoal([g]); }}
                className="mb-1.5 flex w-full items-center gap-1.5 rounded-md bg-ok/20 px-2 py-1 text-left text-[13px] font-semibold text-ok"
              >
                🎯
                {g.clientName && <span className="font-bold text-accent">{g.clientName.split(" ")[0]}</span>}
                <span className={g.clientName ? "font-normal" : ""}>{g.competition}</span>
                {g.place && <span className="font-normal opacity-80">· {g.place}</span>}
                <span className="ml-auto text-[11px] opacity-80">{countdownLabel(g.date)}</span>
              </button>
            ))}
            {dayInjuries.map((f) => (
              <div key={f.id} className="mb-1.5 flex items-center gap-1.5 rounded-md bg-danger/15 px-2 py-1 text-[13px] font-semibold text-danger">
                🩹 {f.text.split("\n")[0].slice(0, 60)}
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              {sessions.length === 0 ? (
                <span className="text-[13px] italic text-dim">Repos / rien de prévu</span>
              ) : (
                sessions.map((s) => <SessionPill key={s.id} s={s} onOpen={onOpen} big todayKey={todayKey} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
