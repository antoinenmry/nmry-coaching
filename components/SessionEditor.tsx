"use client";

import { useMemo, useRef, useState } from "react";
import { useData } from "./DataProvider";
import ExercisePicker, { type InlineExercise } from "./ExercisePicker";
import MiniCalendar from "./plan/MiniCalendar";
import { exerciseInstanceFromLibrary, SESSION_COLORS } from "@/lib/data";
import type { ExerciseInstance, Role } from "@/lib/types";
import { getMaxRecord, saveStrengthRecord } from "@/lib/prDetection";
import { beforeRemove, cutAt, groupExercises, linkAt, moveWithLinks, toggleGroupType } from "@/lib/exerciseLinks";

const FEEL_LABELS = ["", "Très dur", "Dur", "Correct", "Bien", "Excellent"]; // ressenti 1 → 5
const MONTHS_SHORT = ["JANV", "FÉV", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"];
const DAYS_SHORT = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];

// Tuile date à la couleur de la séance ; un input date natif invisible la recouvre
// → un tap ouvre le sélecteur du téléphone pour déplacer la séance.
function DateTile({ date, color, locked, onChange }: { date: string | null; color: string; locked: boolean; onChange: (v: string) => void }) {
  const d = date ? new Date(date + "T00:00:00") : null;
  return (
    <label
      className={`relative grid h-[66px] w-[62px] shrink-0 place-content-center rounded-[18px] text-center leading-none text-white ${locked ? "" : "cursor-pointer active:scale-95"}`}
      style={{
        background: `linear-gradient(160deg, color-mix(in srgb, ${color} 88%, white), ${color})`,
        boxShadow: `0 10px 24px -12px ${color}`,
      }}
      title={locked ? "Séance validée : date figée" : "Changer la date"}
    >
      {d ? (
        <>
          <span className="text-[10px] font-black tracking-[0.1em] opacity-90">{DAYS_SHORT[d.getDay()]}</span>
          <span className="my-0.5 text-[26px] font-black">{d.getDate()}</span>
          <span className="text-[10px] font-black tracking-[0.1em] opacity-90">{MONTHS_SHORT[d.getMonth()]}</span>
        </>
      ) : (
        <span className="text-[11px] font-black">À placer</span>
      )}
      {!locked && (
        <input
          type="date"
          value={date ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Date de la séance"
          className="absolute inset-0 !h-full !w-full cursor-pointer opacity-0"
        />
      )}
    </label>
  );
}

// Ressenti de la séance en gouttes d'eau : n/5 = n gouttes remplies. Re-toucher la valeur la retire.
function FeelDrops({ value, readOnly, onChange }: { value: number; readOnly: boolean; onChange: (v: number) => void }) {
  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface2 px-3.5 py-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-black">Ressenti de la séance</span>
        <span className={`text-[12px] font-black ${value ? "text-accent2" : "text-dim"}`}>
          {value ? `${value} / 5 · ${FEEL_LABELS[value]}` : "— / 5"}
        </span>
      </div>
      <div className="grid grid-cols-5">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= value;
          return (
            <button
              key={n}
              type="button"
              disabled={readOnly}
              onClick={() => onChange(value === n ? 0 : n)}
              aria-label={`${n} sur 5`}
              aria-pressed={on}
              className="grid place-items-center py-1 transition active:scale-90 disabled:cursor-default"
            >
              <svg aria-hidden width="30" height="38" viewBox="0 0 30 40">
                <defs>
                  <linearGradient id={`drop-${n}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#7cc3f8" />
                    <stop offset="1" stopColor="#1e88e5" />
                  </linearGradient>
                </defs>
                <path
                  d="M15 3C15 3 5 16 5 24a10 10 0 0 0 20 0C25 16 15 3 15 3z"
                  fill={on ? `url(#drop-${n})` : "transparent"}
                  stroke={on ? "var(--color-accent2)" : "color-mix(in srgb, var(--color-accent2) 55%, var(--color-dim))"}
                  strokeWidth="1.8"
                />
              </svg>
              <span className={`text-[10px] font-black ${on ? "text-accent2" : "text-dim"}`}>{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Pace helpers (allure min/km) ----

function parsePaceToMinutes(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const colon = s.match(/^(\d{1,2}):(\d{2})$/);
  if (colon) {
    const secs = parseInt(colon[2], 10);
    if (secs >= 60) return null;
    return parseInt(colon[1], 10) + secs / 60;
  }
  const n = parseFloat(s);
  return !isNaN(n) && n > 0 ? n : null;
}

function fmtPaceDisplay(minutes: number): string {
  if (!minutes || minutes <= 0) return "";
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return `${m} min ${s.toString().padStart(2, "0")} s/km`;
}

function minutesToPaceInput(minutes: number): string {
  if (!minutes || minutes <= 0) return "";
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PaceInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
}) {
  const [raw, setRaw] = useState(() => minutesToPaceInput(value));
  const focusedRef = useRef(false);

  // Sync when value changes externally (e.g. coach edits, parent re-renders)
  const prevValue = useRef(value);
  if (!focusedRef.current && prevValue.current !== value) {
    prevValue.current = value;
    setRaw(minutesToPaceInput(value));
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const r = e.target.value;
    setRaw(r);
    const parsed = parsePaceToMinutes(r);
    if (parsed !== null) onChange(parsed);
  };

  const handleBlur = () => {
    focusedRef.current = false;
    const parsed = parsePaceToMinutes(raw);
    if (parsed !== null) {
      setRaw(minutesToPaceInput(parsed));
      onChange(parsed);
    } else if (!raw.trim()) {
      onChange(0);
      setRaw("");
    }
  };

  const parsed = parsePaceToMinutes(raw);

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={raw}
          onChange={handleChange}
          onFocus={() => { focusedRef.current = true; }}
          onBlur={handleBlur}
          placeholder={placeholder ?? "ex : 5:30"}
          className="flex-1"
        />
        <span className="shrink-0 rounded-lg bg-surface px-2.5 py-1.5 text-[13px] font-semibold text-dim">
          min/km
        </span>
      </div>
      {parsed !== null && (
        <p className="mt-1 text-[12px] font-semibold text-ok">{fmtPaceDisplay(parsed)}</p>
      )}
    </div>
  );
}

// ---- RPE helpers ----

/** Parse "7", "7.5", "7/8", "7-8", "~7" → { lo, hi } ou null si non parseable */
function parseRpe(val: string | number | undefined): { lo: number; hi: number } | null {
  if (val === undefined || val === null || val === "" || val === 0) return null;
  const s = String(val).trim();
  if (!s || s === "0") return null;
  const rangeMatch = s.match(/^(\d+(?:\.\d+)?)\s*[\/\-]\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1]);
    const b = parseFloat(rangeMatch[2]);
    if (!isNaN(a) && !isNaN(b)) return { lo: Math.min(a, b), hi: Math.max(a, b) };
  }
  const num = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!isNaN(num) && num >= 0 && num <= 10) return { lo: num, hi: num };
  return null;
}

/** Barre dégradée vert→jaune→orange→rouge→noir avec curseur ou plage */
function RpeGauge({ value }: { value: string | number | undefined }) {
  const parsed = parseRpe(value);
  return (
    <div className="mt-1.5">
      <div
        className="relative h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: "linear-gradient(to right,#22c55e 0%,#eab308 40%,#f97316 65%,#ef4444 84%,#111 100%)" }}
      >
        {parsed && (
          parsed.lo === parsed.hi ? (
            // Curseur simple : fine barre blanche
            <div
              className="absolute top-0 h-full w-1 -translate-x-1/2 rounded-full bg-white shadow"
              style={{ left: `${(parsed.lo / 10) * 100}%` }}
            />
          ) : (
            // Plage : segment blanc semi-transparent
            <div
              className="absolute top-0 h-full bg-white/80"
              style={{ left: `${(parsed.lo / 10) * 100}%`, width: `${((parsed.hi - parsed.lo) / 10) * 100}%`, minWidth: 4 }}
            />
          )
        )}
      </div>
    </div>
  );
}

function frenchDate(key: string) {
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

export default function SessionEditor({
  sessionId,
  role,
  fresh = false,
  onClose,
}: {
  sessionId: string;
  role: Role;
  /** Séance qui vient d'être créée : mode prescription uniquement. */
  fresh?: boolean;
  onClose: () => void;
}) {
  const { update, state, library, activeUserId, me } = useData();
  const session = state.sessions.find((s) => s.id === sessionId);
  const [picking, setPicking] = useState(false);
  // Dates supplémentaires cochées dans le calendrier → une copie de la séance par date.
  const [copyDates, setCopyDates] = useState<string[]>([]);
  const [copiedCount, setCopiedCount] = useState(0);
  const [dupOpen, setDupOpen] = useState(false);
  // Déroulé : une seule ligne d'exercice ouverte à la fois.
  const [openUid, setOpenUid] = useState<string | null>(null);

  const videoById = Object.fromEntries(library.exercises.map((e) => [e.id, e.video]));

  const recordsByExId = useMemo(() => {
    const map = new Map<string, number>();
    state.records.strength.forEach((er) => {
      if (er.entries.length > 0)
        map.set(er.exId, Math.max(...er.entries.map((e) => e.weight)));
    });
    return map;
  }, [state.records.strength]);

  // IDs des options marquées "allure" (isPace) dans les catégories de filtre
  const paceOptionIds = useMemo(() => {
    const ids = new Set<string>();
    library.categories.forEach((c) => c.options.forEach((o) => { if (o.isPace) ids.add(o.id); }));
    return ids;
  }, [library]);

  // IDs des exercices qui utilisent l'allure (min/km) plutôt que le poids (kg)
  const paceExIds = useMemo(() => {
    const ids = new Set<string>();
    library.exercises.forEach((ex) => {
      const hasPace = Object.values(ex.tags).flat().some((t) => paceOptionIds.has(t));
      if (hasPace) ids.add(ex.id);
    });
    return ids;
  }, [library, paceOptionIds]);
  const isCoach = role === "coach" || role === "admin";
  // Auto-suivi : coach/admin éditant SA PROPRE séance (pas celle d'un sportif sélectionné)
  // → en plus de la prescription, on lui montre aussi le ressenti/validation/RPE sportif.
  // Pas d'auto-suivi sur une séance tout juste créée ni sur une séance non placée :
  // le coach est alors en train de prescrire, pas de s'entraîner.
  const isSelf = activeUserId === me?.id && !fresh && !!session?.date;
  const backdropRef = useRef(false);

  const patchSession = (patch: Partial<typeof session>) =>
    update((d) => {
      const s = d.sessions.find((x) => x.id === sessionId);
      if (s) Object.assign(s, patch);
    });

  const patchEx = (exUid: string, patch: Partial<ExerciseInstance>) =>
    update((d) => {
      const ex = d.sessions.find((x) => x.id === sessionId)?.exercises.find((e) => e.uid === exUid);
      if (ex) Object.assign(ex, patch);
    });

  const addExercises = (libIds: string[], inline: InlineExercise[] = []) =>
    update((d) => {
      const s = d.sessions.find((x) => x.id === sessionId);
      if (!s) return;
      // ⚠️ En mode auth, la bibliothèque vient de `library_state` (hook `library`), PAS de
      // `d.library` (app_state, vide) → sinon le nom retombe sur "Exercice". Un même id peut
      // apparaître plusieurs fois dans libIds (ajout multiple) : on pousse une instance par occurrence.
      libIds.forEach((id) => {
        const libEx = library.exercises.find((e) => e.id === id);
        s.exercises.push(exerciseInstanceFromLibrary({ id, name: libEx?.name ?? "Exercice" }));
      });
      inline.forEach(({ id, name }) => {
        const libEx = library.exercises.find((e) => e.id === id);
        s.exercises.push(exerciseInstanceFromLibrary({ id, name: libEx?.name ?? name }));
      });
    });

  // Duplique la séance sur chaque date cochée : nouvelle instance par date, prescription
  // conservée (nom, couleur, commentaire coach, exercices) et suivi sportif remis à zéro.
  const duplicateToDates = () => {
    // ⚠️ On clone depuis `session` (état simple) et NON depuis le brouillon immer :
    // structuredClone() sur un Proxy de brouillon n'est pas fiable.
    const src = session;
    if (!src || copyDates.length === 0) return;
    const copies = copyDates.map((date) => ({
      ...structuredClone(src),
      id: crypto.randomUUID(),
      date,
      done: false,
      emoji: 0,
      exercises: src.exercises.map((ex) => ({
        ...structuredClone(ex),
        uid: crypto.randomUUID(),
        rpeClient: 0,
        clientComment: "",
        weightClient: undefined,
        failed: undefined,
        setLogs: undefined,
        prDismissedWeight: undefined,
      })),
    }));
    update((d) => { d.sessions.push(...copies); });
  };

  const confirmDuplicate = () => {
    if (copyDates.length === 0) return;
    duplicateToDates();
    setCopiedCount(copyDates.length);
    setCopyDates([]);
    setTimeout(() => setCopiedCount(0), 4000);
  };

  const removeExercise = (exUid: string) =>
    update((d) => {
      const s = d.sessions.find((x) => x.id === sessionId);
      if (!s) return;
      // Sort l'exercice de son superset/circuit sans casser le reste du groupe.
      beforeRemove(s.exercises, s.exercises.findIndex((e) => e.uid === exUid));
      s.exercises = s.exercises.filter((e) => e.uid !== exUid);
    });

  const moveExercise = (exUid: string, dir: -1 | 1) =>
    update((d) => {
      const s = d.sessions.find((x) => x.id === sessionId);
      if (!s) return;
      // Déplacé, l'exercice quitte son groupe : un lien n'existe qu'entre voisins.
      moveWithLinks(s.exercises, s.exercises.findIndex((e) => e.uid === exUid), dir);
    });

  // Supersets & circuits (cf. lib/exerciseLinks.ts) — `idx` = lien entre idx et idx + 1.
  const editLinks = (fn: (list: ExerciseInstance[], idx: number) => void, idx: number) =>
    update((d) => {
      const s = d.sessions.find((x) => x.id === sessionId);
      if (s) fn(s.exercises, idx);
    });

  const deleteSession = () => {
    update((d) => {
      d.sessions = d.sessions.filter((x) => x.id !== sessionId);
    });
    onClose();
  };

  if (!session) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onPointerDown={(e) => { backdropRef.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (backdropRef.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto overflow-x-hidden rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        {/* ─── En-tête : tuile date (tap = changer la date) + nom ─── */}
        <div className="relative flex items-center gap-3 pr-11">
          <button onClick={onClose} className="absolute right-0 top-0 grid h-9 w-9 place-items-center rounded-full bg-surface2" aria-label="Fermer">✕</button>
          <DateTile
            date={session.date}
            color={session.color}
            locked={session.done && !isCoach}
            onChange={(v) => patchSession({ date: v || null })}
          />
          <div className="min-w-0 flex-1">
            {isCoach ? (
              <input
                value={session.name}
                onChange={(e) => patchSession({ name: e.target.value })}
                className="!border-0 !bg-transparent !p-0 !text-[21px] font-black leading-tight"
                aria-label="Nom de la séance"
              />
            ) : (
              <h2 className="text-[21px] font-black leading-tight">{session.name}</h2>
            )}
            <p className="mt-0.5 text-[12.5px] text-dim">
              {session.date ? frenchDate(session.date) : "Non placée · touche la date"}
              {session.done && !isCoach && " · date figée"}
            </p>
          </div>
        </div>

        {/* Réglages coach : couleur + duplication (calendrier seulement au tap) */}
        {isCoach && (
          <div className="mt-3.5">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1.5">
                {SESSION_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => patchSession({ color: c })}
                    className={`h-6 w-6 rounded-full transition ${session.color === c ? "shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-ink)]" : ""}`}
                    style={{ background: c }}
                    aria-label={`Couleur ${c}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDupOpen((v) => !v)}
                aria-expanded={dupOpen}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-black transition ${
                  dupOpen ? "border-[#a855f7] bg-[#a855f7]/15 text-[#c084fc]" : "border-line bg-surface2 text-ink"
                }`}
              >
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="8" y="8" width="13" height="13" rx="3" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>
                Dupliquer
              </button>
            </div>
            {copiedCount > 0 && (
              <p className="mt-2 rounded-xl bg-ok/15 px-3 py-2 text-[13px] font-semibold text-ok">
                {copiedCount} copie{copiedCount > 1 ? "s" : ""} créée{copiedCount > 1 ? "s" : ""}
              </p>
            )}
            {dupOpen && (
              <div className="mt-2.5">
                <MiniCalendar
                  selected={copyDates}
                  marked={session.date ? [session.date] : []}
                  initialMonth={session.date ?? new Date().toISOString().slice(0, 10)}
                  onToggle={(d) =>
                    setCopyDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))
                  }
                />
                <button
                  type="button"
                  onClick={() => { confirmDuplicate(); setDupOpen(false); }}
                  disabled={copyDates.length === 0}
                  className="mt-2 w-full rounded-full bg-gradient-to-br from-[#c084fc] to-[#a855f7] py-2.5 text-[13px] font-black text-white disabled:opacity-40"
                >
                  {copyDates.length === 0
                    ? "Coche un ou plusieurs jours"
                    : `Dupliquer sur ${copyDates.length} date${copyDates.length > 1 ? "s" : ""}`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Note du coach (séance) — encart à liseré doré */}
        {(isCoach || (session.coachComment ?? "")) && (
          <div className="relative mt-4 rounded-2xl bg-surface2 py-2.5 pl-4 pr-3">
            <span aria-hidden className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-full bg-accent" />
            <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-accent">Note du coach</span>
            {isCoach ? (
              <textarea
                value={session.coachComment ?? ""}
                onChange={(e) => patchSession({ coachComment: e.target.value })}
                placeholder="Consignes générales, objectifs, contexte…"
                className="!min-h-[44px] !border-0 !bg-transparent !p-0 !text-[14px]"
              />
            ) : (
              <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-snug">{session.coachComment}</p>
            )}
          </div>
        )}

        {/* Ressenti de la séance : 5 gouttes, 3/5 = 3 gouttes pleines */}
        {/* Côté coach (création / édition) : inutile tant que le sportif n'a rien saisi. */}
        {(!isCoach || isSelf || session.emoji > 0) && (
          <FeelDrops
            value={session.emoji}
            readOnly={isCoach && !isSelf}
            onChange={(v) => patchSession({ emoji: v })}
          />
        )}

        {/* Valider la séance (client, ou coach/admin sur sa propre séance) */}
        {(!isCoach || isSelf) && session.date && (
          <button
            onClick={() => patchSession({ done: !session.done })}
            className={`mt-3 w-full rounded-full py-3 font-black transition active:scale-[0.98] ${
              session.done
                ? "bg-surface2 text-ok shadow-[inset_0_0_0_1.5px_var(--color-ok)]"
                : "bg-gradient-to-br from-[#86d98a] to-[#43a047] text-[#0d2410] shadow-[0_8px_22px_-10px_rgba(102,187,106,0.9)]"
            }`}
          >
            {session.done ? "Séance validée · toucher pour annuler" : "Valider la séance"}
          </button>
        )}

        <div className="mt-4">
          {session.exercises.length > 0 && (
            <div className="mb-2 flex items-center justify-between px-0.5">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-dim">Déroulé</span>
              <span className="text-[11px] font-black text-dim">
                {(!isCoach || isSelf || session.exercises.some(exerciseStatusDone))
                  ? `${session.exercises.filter(exerciseStatusDone).length} / ${session.exercises.length} fait`
                  : `${session.exercises.length} exercice${session.exercises.length > 1 ? "s" : ""}`}
              </span>
            </div>
          )}
          {(() => {
            const renderEx = (idx: number) => {
              const ex = session.exercises[idx];
              const next = session.exercises[idx + 1];
              return (
                <ExerciseBlock
                  key={ex.uid}
                  ex={ex}
                  color={session.color}
                  open={openUid === ex.uid}
                  onToggle={() => setOpenUid(openUid === ex.uid ? null : ex.uid)}
                  onNext={() => setOpenUid(next ? next.uid : null)}
                  hasNext={!!next}
                  index={idx}
                  total={session.exercises.length}
                  video={videoById[ex.exId]}
                  isCoach={isCoach}
                  isSelf={isSelf}
                  isPace={paceExIds.has(ex.exId)}
                  onPatch={(patch) => patchEx(ex.uid, patch)}
                  onRemove={() => removeExercise(ex.uid)}
                  onMove={(dir) => moveExercise(ex.uid, dir)}
                  recordMax={recordsByExId.get(ex.exId)}
                  onSaveRecord={(weight, reps) =>
                    update((d) => saveStrengthRecord(d.records, ex.exId, ex.name, weight, reps))
                  }
                />
              );
            };
            const groups = groupExercises(session.exercises);
            return groups.map((g, gi) => {
              const last = g.indices[g.indices.length - 1];
              const label = g.type === "circuit" ? "CIRCUIT" : "SUPERSET";
              return (
                <div key={session.exercises[g.indices[0]].uid}>
                  {g.type ? (
                    // Groupe relié : trait jaune à gauche, type écrit à la verticale le long du trait.
                    // Le trait est coupé en deux segments autour du mot (plutôt que masqué par un
                    // fond) pour rester propre sur les thèmes translucides comme Aurora.
                    <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-2">
                      <div className="flex flex-col items-center py-1.5">
                        <span className="w-[3px] flex-1 rounded-full bg-accent" />
                        {isCoach ? (
                          <button
                            type="button"
                            onClick={() => editLinks(toggleGroupType, g.indices[0])}
                            title="Basculer SUPERSET / CIRCUIT"
                            aria-label={`${label} — basculer en ${g.type === "circuit" ? "superset" : "circuit"}`}
                            className="my-1.5 rotate-180 rounded-md py-1 text-[11px] font-black leading-[22px] tracking-[0.22em] text-accent [writing-mode:vertical-rl] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                          >
                            {label}
                          </button>
                        ) : (
                          <span className="my-1.5 rotate-180 py-1 text-[11px] font-black leading-[22px] tracking-[0.22em] text-accent [writing-mode:vertical-rl]">
                            {label}
                          </span>
                        )}
                        <span className="w-[3px] flex-1 rounded-full bg-accent" />
                      </div>
                      <div className="min-w-0">
                        {g.indices.map((idx, k) => (
                          <div key={session.exercises[idx].uid}>
                            {renderEx(idx)}
                            {k < g.indices.length - 1 && (
                              isCoach ? (
                                <div className="flex h-6 items-center justify-center">
                                  <button
                                    type="button"
                                    onClick={() => editLinks(cutAt, idx)}
                                    title="Couper le groupe ici"
                                    aria-label="Délier ces deux exercices"
                                    className="rounded-full border border-dashed border-accent/40 px-2.5 text-[11px] font-bold leading-4 text-accent/80 transition hover:border-danger hover:text-danger"
                                  >
                                    ✂
                                  </button>
                                </div>
                              ) : (
                                <div className="h-2.5" />
                              )
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    renderEx(g.indices[0])
                  )}
                  {gi < groups.length - 1 && (
                    isCoach ? (
                      <div className="flex h-[34px] items-center justify-center">
                        <button
                          type="button"
                          onClick={() => editLinks(linkAt, last)}
                          aria-label={`Lier ${session.exercises[last].name} et ${session.exercises[last + 1].name}`}
                          className="rounded-full border border-dashed border-line px-3 py-0.5 text-[11.5px] font-bold text-dim opacity-75 transition hover:border-accent hover:text-accent hover:opacity-100"
                        >
                          + lier
                        </button>
                      </div>
                    ) : (
                      <div className="h-2.5" />
                    )
                  )}
                </div>
              );
            });
          })()}
          {session.exercises.length === 0 && (
            <p className="py-3 text-center text-[13px] text-dim">Aucun exercice.</p>
          )}
        </div>

        {/* Actions coach */}
        {isCoach && (
          <>
            <button
              onClick={() => setPicking(true)}
              className="mt-3 w-full rounded-xl border border-dashed border-line py-3 font-semibold text-dim"
            >
              + Ajouter des exercices
            </button>
            {picking && <ExercisePicker onConfirm={(libIds, inline) => addExercises(libIds, inline)} onClose={() => setPicking(false)} />}
           <div className="mt-4 grid grid-cols-2 gap-3">
  {/* 1. Supprimer passe en premier (à gauche) */}
  <button onClick={deleteSession} className="rounded-xl bg-danger py-3 font-semibold text-white">
    Supprimer
  </button>
  
  {/* 2. Valider passe en deuxième (à droite) et passe au vert avec bg-ok */}
  <button onClick={onClose} className="rounded-xl bg-ok py-3 font-semibold text-[#06210a]">
    Valider
  </button>
</div>
          </>
        )}
      </div>
    </div>
  );
}

function SetLogsSection({
  ex,
  isCoach,
  onPatch,
}: {
  ex: ExerciseInstance;
  isCoach: boolean;
  onPatch: (patch: Partial<ExerciseInstance>) => void;
}) {
  const [open, setOpen] = useState(false);

  const logs = ex.setLogs ?? [];
  const targetSets = ex.sets || 0;
  // Séries de travail = ni échauffement ni échec ; échec compte comme série de travail réalisée
  const workSetsFilled = logs.filter((l) => l.kind !== "warmup" && (l.w > 0 || l.r > 0)).length;
  const workSetsTotal = logs.filter((l) => l.kind !== "warmup").length;

  function ensureRows() {
    if (!open) {
      if (logs.length === 0 && targetSets > 0) {
        const defW = ex.weightClient ?? ex.weight;
        onPatch({ setLogs: Array.from({ length: targetSets }, () => ({ w: defW, r: 0 })) });
      }
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  function patchLog(i: number, patch: Partial<{ w: number; r: number; kind: "warmup" | "fail" | undefined }>) {
    const next = [...logs];
    next[i] = { ...next[i], ...patch };
    onPatch({ setLogs: next });
  }

  // Cycle au tap : travail → échauffement → échec → travail
  function cycleKind(i: number) {
    const cur = logs[i]?.kind;
    const next = cur === undefined ? "warmup" : cur === "warmup" ? "fail" : undefined;
    patchLog(i, { kind: next });
  }

  function addRow() {
    onPatch({ setLogs: [...logs, { w: ex.weightClient ?? ex.weight, r: 0 }] });
  }

  function removeRow(i: number) {
    onPatch({ setLogs: logs.filter((_, idx) => idx !== i) });
  }

  // Numéro de série de travail (les échauffements ne sont pas numérotés)
  function workNumber(idx: number) {
    let n = 0;
    for (let k = 0; k <= idx; k++) {
      if (logs[k]?.kind !== "warmup") n++;
    }
    return n;
  }

  return (
    <div className="mt-2.5 overflow-hidden rounded-xl border border-line">
      {/* Toggle */}
      <button
        type="button"
        onClick={ensureRows}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-surface"
      >
        <span className="text-[12px] text-dim">{open ? "▼" : "▶"}</span>
        <span className="flex-1 text-[13px] font-semibold text-ink">Détail des séries réalisées</span>
        {workSetsFilled > 0 ? (
          <span className="rounded-full bg-ok/20 px-2.5 py-0.5 text-[11px] font-bold text-ok">
            {workSetsFilled}/{Math.max(workSetsTotal, targetSets)} loggées
          </span>
        ) : (
          <span className="text-[11px] text-dim">
            {targetSets > 0 ? `0 / ${targetSets}` : "vide"}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-line">
          {/* En-têtes colonnes */}
          {logs.length > 0 && (
            <div className="grid grid-cols-[28px_1fr_1fr_36px] gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-dim">
              <span></span>
              <span>{ex.weight > 0 ? "Poids (kg)" : "Poids"}</span>
              <span>Reps</span>
              <span></span>
            </div>
          )}

          {logs.map((log, i) => {
            const hasData = log.w > 0 || log.r > 0;
            const isWarm = log.kind === "warmup";
            const isFail = log.kind === "fail";
            const rowBg = isWarm ? "bg-accent/8" : isFail ? "bg-danger/8" : "";
            const inputAccent = isWarm ? "border-accent/40 bg-accent/5" : isFail ? "border-danger/40 bg-danger/5" : "";
            return (
              <div
                key={i}
                className={`grid grid-cols-[28px_1fr_1fr_36px] items-center gap-1 border-t border-line/50 px-3 py-1.5 ${rowBg}`}
              >
                {/* Badge cyclable : travail → 🔥 échauffement → ❌ échec */}
                <button
                  type="button"
                  onClick={() => cycleKind(i)}
                  title={isWarm ? "Échauffement (taper → échec)" : isFail ? "Échec (taper → série de travail)" : "Série de travail (taper → échauffement)"}
                  className={`grid h-6 w-6 place-items-center rounded-md text-[11px] font-bold transition cursor-pointer hover:opacity-80 ${
                    isWarm
                      ? "bg-accent/20 text-accent"
                      : isFail
                        ? "bg-danger text-white"
                        : hasData
                          ? "bg-ok/20 text-ok"
                          : "bg-surface text-dim"
                  }`}
                >
                  {isWarm ? "🔥" : isFail ? "❌" : `S${workNumber(i)}`}
                </button>

                {/* Poids réalisé */}
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  placeholder={ex.weight > 0 ? String(ex.weight) : "—"}
                  value={log.w || ""}
                  onChange={(e) => patchLog(i, { w: +e.target.value || 0 })}
                  className={`min-w-0 text-sm ${inputAccent}`}
                />

                {/* Reps réalisées */}
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder={ex.reps > 0 ? String(ex.reps) : "—"}
                  value={log.r || ""}
                  onChange={(e) => patchLog(i, { r: +e.target.value || 0 })}
                  className={`min-w-0 text-sm ${inputAccent}`}
                />

                {/* Supprimer */}
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-[12px] text-dim hover:text-danger"
                >✕</button>
              </div>
            );
          })}

          {/* Ajouter une série */}
          <button
            type="button"
            onClick={addRow}
            className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-line px-3 py-2 text-[12px] text-dim hover:text-ink"
          >
            + Ajouter une série
          </button>

          {/* Légende du cycle de tap */}
          {logs.length > 0 && (
            <p className="border-t border-line px-3 py-2 text-[11px] text-dim">
              Tape sur le numéro : <span className="font-semibold text-ink">S1</span> travail → <span className="font-semibold text-accent">🔥</span> échauffement → <span className="font-semibold text-danger">❌</span> échec
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Un exercice compte comme « fait » dès que le sportif a saisi quelque chose de réalisé.
function exerciseStatusDone(ex: ExerciseInstance): boolean {
  if (ex.failed) return false;
  return (ex.weightClient ?? 0) > 0 || ex.rpeClient > 0 || (ex.setLogs ?? []).some((l) => l.w > 0 || l.r > 0);
}

function ExerciseBlock({
  ex,
  color,
  open,
  onToggle,
  onNext,
  hasNext,
  index,
  total,
  video,
  isCoach,
  isSelf,
  isPace,
  onPatch,
  onRemove,
  onMove,
  recordMax,
  onSaveRecord,
}: {
  ex: ExerciseInstance;
  color: string;
  open: boolean;
  onToggle: () => void;
  onNext: () => void;
  hasNext: boolean;
  index: number;
  total: number;
  video?: string;
  isPace?: boolean;
  isCoach: boolean;
  isSelf: boolean;
  onPatch: (patch: Partial<ExerciseInstance>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  recordMax?: number;
  onSaveRecord: (weight: number, reps: number) => void;
}) {
  const [savedWeight, setSavedWeight] = useState<number | null>(null);

  const hasRealized = (ex.weightClient ?? 0) > 0;

  const workLogs = (ex.setLogs ?? []).filter((l) => l.kind !== "warmup");
  const maxLogWeight = workLogs.length > 0 ? Math.max(...workLogs.map((l) => l.w)) : 0;
  const effectiveWeight = Math.max(ex.weightClient ?? 0, maxLogWeight);

  const isPr =
    !isPace &&
    (!isCoach || isSelf) &&
    effectiveWeight > 0 &&
    (recordMax === undefined || effectiveWeight > recordMax);
  // La décision (enregistrer / ignorer) est PERSISTÉE sur l'exercice (prDismissedWeight)
  // → la bannière ne réapparaît plus à la réouverture de la séance.
  const showBanner = isPr && effectiveWeight !== ex.prDismissedWeight;
  const showSaved = savedWeight !== null && effectiveWeight === savedWeight && !isPr;

  // ─── Ligne du déroulé : nom + note | séries × reps | charge ───
  const done = exerciseStatusDone(ex);
  const barColor = open
    ? "var(--color-accent)"
    : ex.failed
      ? "var(--color-danger)"
      : done
        ? "var(--color-ok)"
        : isCoach && !isSelf
          ? color
          : "#6b7280";
  const setsReps = [ex.setsLabel ?? (ex.sets || ""), ex.repsLabel ?? (ex.reps || "")].filter((v) => v !== "").join(" × ");
  const prescribed = ex.weightLabel || (ex.weight > 0 ? (isPace ? fmtPaceDisplay(ex.weight) : `${ex.weight} kg`) : "");
  const realized = hasRealized ? (isPace ? fmtPaceDisplay(ex.weightClient ?? 0) : `${ex.weightClient} kg`) : "";

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition ${open ? "border-accent/50" : "border-line"}`}
      style={{
        background: open
          ? "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 8%, var(--color-surface2)), var(--color-surface2))"
          : "var(--color-surface2)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[4px_minmax(0,1fr)_auto_minmax(0,68px)] items-center gap-3 px-3 py-3 text-left"
      >
        <span aria-hidden className="min-h-[22px] self-stretch rounded" style={{ background: barColor }} />
        <span className="min-w-0">
          <span className="block text-[15px] font-black leading-tight">{ex.name}</span>
          {(ex.coachComment ?? "") && (
            <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-dim">{ex.coachComment}</span>
          )}
        </span>
        <span className="whitespace-nowrap text-right text-[15px] font-black">{setsReps || "—"}</span>
        <span
          className={`truncate text-right text-[14px] ${
            ex.failed ? "font-black text-danger" : realized ? "font-black text-ok" : prescribed ? "font-bold text-dim" : "text-dim"
          }`}
        >
          {ex.failed ? "Raté" : realized || prescribed || "—"}
        </span>
      </button>

      {open && (
      <div className="border-t border-line/60 px-3 pb-3 pt-2.5">
      {/* Contrôles : vidéo + ordre / retrait (coach) */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {video && (
            <a href={video} target="_blank" rel="noreferrer" className="text-[13px] font-bold text-accent2">▶ Voir la vidéo</a>
          )}
        </div>
        {isCoach && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
              className="grid h-7 w-7 place-items-center rounded text-dim disabled:opacity-20 hover:text-ink" aria-label="Monter">▲</button>
            <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}
              className="grid h-7 w-7 place-items-center rounded text-dim disabled:opacity-20 hover:text-ink" aria-label="Descendre">▼</button>
            <button onClick={onRemove}
              className="ml-0.5 rounded-lg bg-surface px-2.5 py-1 text-[13px] text-dim hover:text-danger">✕</button>
          </div>
        )}
      </div>

      {/* Prescription coach — 3 colonnes inline */}
      {isCoach ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold text-ink">Séries</span>
              <input
                type="text" inputMode="numeric" placeholder="3 ou 2-4"
                value={ex.setsLabel ?? (ex.sets || "")}
                onChange={(e) => {
                  const raw = e.target.value;
                  const num = parseInt(raw.split("-")[0], 10);
                  onPatch({ setsLabel: raw, sets: isNaN(num) ? 0 : num });
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold text-ink">Répétitions</span>
              <input
                type="text" inputMode="numeric" placeholder="10 ou 8-12"
                value={ex.repsLabel ?? (ex.reps || "")}
                onChange={(e) => {
                  const raw = e.target.value;
                  const num = parseInt(raw.split("-")[0], 10);
                  onPatch({ repsLabel: raw, reps: isNaN(num) ? 0 : num });
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold text-ink">{isPace ? "Allure" : "kg/RPE/%"}</span>
              {/* Champ libre : le coach peut prescrire "80", "70%", "RPE 8", "au ressenti"…
                  On garde `weight` (numerique) synchronise quand le texte est un nombre simple,
                  pour les affichages et exports qui s'appuient encore dessus. */}
              <input
                type="text"
                value={ex.weightLabel ?? (ex.weight ? String(ex.weight) : "")}
                onChange={(e) => {
                  const raw = e.target.value;
                  const num = parseFloat(raw.replace(",", "."));
                  onPatch({
                    weightLabel: raw || undefined,
                    weight: /^\s*\d+([.,]\d+)?\s*$/.test(raw) && !isNaN(num) ? num : 0,
                  });
                }}
                placeholder=""
              />
            </label>
          </div>

          <label className="mt-2.5 block">
            <span className="mb-1 block text-[13px] font-semibold text-ink">Commentaire coach</span>
            <textarea
              value={ex.coachComment ?? ""}
              onChange={(e) => onPatch({ coachComment: e.target.value })}
              placeholder=""
              className="min-h-[56px]"
            />
          </label>
        </>
      ) : (
        <>
          {/* Vue client — la prescription est dans la ligne ; ici la note complète du coach
              (elle est tronquée à 2 lignes dans la ligne repliée). */}
          {(ex.coachComment ?? "").length > 90 && (
            <p className="rounded-lg bg-surface p-2 text-[13px]"><span className="text-dim">Coach : </span>{ex.coachComment}</p>
          )}
        </>
      )}

      {/* Séparation visuelle prescription coach ↔ suivi sportif — discrète mais visible.
          Affichée aussi au coach qui consulte un sportif dès qu'il y a un réalisé à montrer,
          sinon le bloc « Réalisé par le sportif » se retrouverait sans en-tête. */}
      {(!isCoach || isSelf || hasRealized) && (
        <div className="my-3 flex items-center gap-2" aria-hidden>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-accent2/50" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-accent2/70">Suivi sportif</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-accent2/50" />
        </div>
      )}

      {/* Réalisé par le sportif — juste sous le séparateur, avant le poids utilisé */}
      {hasRealized && (
        <div className="mb-2.5 flex items-center gap-2 rounded-lg bg-ok/10 px-3 py-1.5">
          <span className="text-[12px] text-dim">Réalisé par le sportif S-1 :</span>
          <span className="text-sm font-bold text-ok">
            {isPace ? fmtPaceDisplay(ex.weightClient ?? 0) : `${ex.weightClient} kg`}
          </span>
        </div>
      )}

      {/* Poids/allure réalisée + bannière PR — sportif, ou coach/admin sur sa propre séance (auto-suivi) */}
      {(!isCoach || isSelf) && (
        <>
          <div>
            <span className="mb-1 block text-[14px] font-semibold text-ink">
              {(ex.weightLabel || ex.weight > 0) ? (isPace ? "Mon allure réalisée" : "Mon poids réalisé") : (isPace ? "Allure réalisée" : "Poids utilisé")}
            </span>
            {isPace ? (
              <PaceInput value={ex.weightClient ?? 0} onChange={(v) => onPatch({ weightClient: v > 0 ? v : undefined })} placeholder="" />
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number" inputMode="decimal" min={0} step={0.5}
                  value={ex.weightClient ?? ""}
                  onChange={(e) => onPatch({ weightClient: e.target.value !== "" ? +e.target.value : undefined })}
                  className="flex-1"
                />
                {showBanner && <span className="shrink-0 text-lg" title="Nouveau record !">🏆</span>}
                <span className="shrink-0 rounded-lg bg-surface px-2.5 py-1.5 text-[13px] font-semibold text-dim">kg</span>
              </div>
            )}
          </div>

          {/* Bannière PR */}
          {showBanner && (
            <div className="mt-2 rounded-xl border border-accent/40 bg-accent/10 p-3">
              <div className="flex items-start gap-2">
                <span className="text-xl">🏆</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-accent">
                    {recordMax === undefined ? "Premier record !" : "Nouveau record !"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-dim">
                    {recordMax !== undefined
                      ? `${recordMax} kg → ${effectiveWeight} kg · +${Math.round((effectiveWeight - recordMax) * 10) / 10} kg`
                      : `${effectiveWeight} kg · premier enregistrement`}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSaveRecord(effectiveWeight, ex.reps || 1);
                    setSavedWeight(effectiveWeight);
                    onPatch({ prDismissedWeight: effectiveWeight });
                  }}
                  className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-[#1a1500]"
                >
                  ✓ Enregistrer le record
                </button>
                <button
                  type="button"
                  onClick={() => onPatch({ prDismissedWeight: effectiveWeight })}
                  className="rounded-lg bg-surface2 px-3 py-1.5 text-[13px] text-dim"
                >
                  Ignorer
                </button>
              </div>
            </div>
          )}
          {showSaved && (
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-ok/15 px-3 py-2 text-[13px] font-semibold text-ok">
              <span>✅</span>
              <span>Record enregistré — {savedWeight} kg</span>
            </div>
          )}
        </>
      )}

      {/* Log par série + RPE sportif : saisie du sportif. Côté coach, affichés seulement
          quand le sportif a déjà rempli quelque chose (inutiles à la création). */}
      {(!isCoach || isSelf || (ex.setLogs ?? []).some((l) => l.w > 0 || l.r > 0)) && (
        <SetLogsSection ex={ex} isCoach={isCoach} onPatch={onPatch} />
      )}

      {(!isCoach || isSelf || ex.rpeClient > 0 || !!ex.failed) && (
      <div className="mt-2.5">
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-[13px] font-semibold text-ink">RPE sportif</span>
          {ex.failed ? (
            <span className="rounded-lg bg-danger/20 px-2.5 py-1 text-sm font-bold text-danger">Raté</span>
          ) : (
            <span className={`rounded-lg px-2.5 py-1 text-sm font-bold ${ex.rpeClient ? "bg-accent2 text-[#06121f]" : "bg-surface text-dim"}`}>
              {ex.rpeClient ? `${ex.rpeClient}/10` : "—"}
            </span>
          )}
          {(!isCoach || isSelf) && !ex.failed && (
            <input type="range" min={0} max={10} step={1} value={ex.rpeClient} onChange={(e) => onPatch({ rpeClient: +e.target.value })} className="flex-1" />
          )}
          {(!isCoach || isSelf) && (
            <button
              type="button"
              onClick={() => onPatch({ failed: !ex.failed, ...(ex.failed ? {} : { rpeClient: 0 }) })}
              title={ex.failed ? "Retirer l'échec" : "Marquer comme raté"}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-black transition ${ex.failed ? "border-danger bg-danger text-white" : "border-danger/40 text-danger"}`}
            >{ex.failed ? "Annuler raté" : "Raté"}</button>
          )}
        </div>
        {ex.rpeClient > 0 && !ex.failed && <RpeGauge value={ex.rpeClient} />}
      </div>
      )}

      {/* Commentaire client */}
      {isCoach && !isSelf ? (
        ex.clientComment ? (
          <p className="mt-2 rounded-lg bg-surface p-2 text-[13px]"><span className="text-dim">Sportif : </span>{ex.clientComment}</p>
        ) : null
      ) : (
        <label className="mt-2.5 block">
          <span className="mb-1 block text-[13px] text-dim">Commentaire sportif</span>
          <textarea
            value={ex.clientComment}
            onChange={(e) => onPatch({ clientComment: e.target.value })}
            className="min-h-[60px]"
          />
        </label>
      )}

      {(!isCoach || isSelf) && (
      <button
        type="button"
        onClick={hasNext ? onNext : onToggle}
        className="mt-3 w-full rounded-full bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] py-2.5 text-[13px] font-black text-[#1a1500] transition active:scale-[0.98]"
      >
        {hasNext ? "Suivant ›" : "OK"}
      </button>
      )}
      </div>
      )}
    </div>
  );
}
