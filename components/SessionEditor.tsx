"use client";

import { useMemo, useRef, useState } from "react";
import { useData } from "./DataProvider";
import ExercisePicker, { type InlineExercise } from "./ExercisePicker";
import { exerciseInstanceFromLibrary, SESSION_COLORS } from "@/lib/data";
import type { ExerciseInstance, Role } from "@/lib/types";

const EMOJIS = ["😫", "😕", "😐", "🙂", "🤩"]; // ressenti 1 → 5

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
  onClose,
}: {
  sessionId: string;
  role: Role;
  onClose: () => void;
}) {
  const { update, state, library } = useData();
  const session = state.sessions.find((s) => s.id === sessionId);
  const [picking, setPicking] = useState(false);

  const videoById = Object.fromEntries(library.exercises.map((e) => [e.id, e.video]));

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
      libIds.forEach((id) => {
        const libEx = d.library.exercises.find((e) => e.id === id);
        s.exercises.push(exerciseInstanceFromLibrary({ id, name: libEx?.name ?? "Exercice" }));
      });
      inline.forEach(({ id, name }) => {
        const libEx = d.library.exercises.find((e) => e.id === id);
        s.exercises.push(exerciseInstanceFromLibrary({ id, name: libEx?.name ?? name }));
      });
    });

  const removeExercise = (exUid: string) =>
    update((d) => {
      const s = d.sessions.find((x) => x.id === sessionId);
      if (s) s.exercises = s.exercises.filter((e) => e.uid !== exUid);
    });

  const moveExercise = (exUid: string, dir: -1 | 1) =>
    update((d) => {
      const s = d.sessions.find((x) => x.id === sessionId);
      if (!s) return;
      const idx = s.exercises.findIndex((e) => e.uid === exUid);
      const target = idx + dir;
      if (target < 0 || target >= s.exercises.length) return;
      [s.exercises[idx], s.exercises[target]] = [s.exercises[target], s.exercises[idx]];
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
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <button onClick={onClose} className="float-right grid h-9 w-9 place-items-center rounded-lg bg-surface2" aria-label="Fermer">✕</button>

        <div className="border-l-4 pl-2.5" style={{ borderColor: session.color }}>
          {isCoach ? (
            <input
              value={session.name}
              onChange={(e) => patchSession({ name: e.target.value })}
              className="!border-0 !bg-transparent !p-0 text-lg font-bold"
              aria-label="Nom de la séance"
            />
          ) : (
            <h2 className="text-lg font-bold">{session.name}</h2>
          )}
          <p className="text-[13px] text-dim">{session.date ? frenchDate(session.date) : "Non placée (à glisser sur un jour)"}</p>
        </div>

        {/* Couleur (coach) */}
        {isCoach && (
          <div className="mt-3 flex gap-2">
            {SESSION_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => patchSession({ color: c })}
                className={`h-7 w-7 rounded-full border-2 ${session.color === c ? "border-ink" : "border-transparent"}`}
                style={{ background: c }}
                aria-label={`Couleur ${c}`}
              />
            ))}
          </div>
        )}

        {/* Reprogrammer */}
        <label className="mt-3 block">
          <span className="mb-1 block text-[13px] text-dim">Date (placement)</span>
          <input
            type="date"
            value={session.date ?? ""}
            onChange={(e) => patchSession({ date: e.target.value || null })}
          />
        </label>

        {/* Commentaire coach (séance globale) */}
        {isCoach ? (
          <label className="mt-3 block">
            <span className="mb-1 block text-[13px] text-dim">Commentaire coach (séance)</span>
            <textarea
              value={session.coachComment ?? ""}
              onChange={(e) => patchSession({ coachComment: e.target.value })}
              placeholder="Consignes générales, objectifs, contexte de la séance…"
              className="min-h-[60px]"
            />
          </label>
        ) : (session.coachComment ?? "") ? (
          <div className="mt-3 rounded-xl border border-line bg-surface2 p-3">
            <span className="mb-1 block text-[13px] text-dim">Note du coach</span>
            <p className="text-sm">{session.coachComment}</p>
          </div>
        ) : null}

        {/* Ressenti séance (client) */}
        <div className="mt-3 rounded-xl border border-line bg-surface2 p-3">
          <span className="mb-2 block text-[13px] text-dim">Ressenti de la séance (sportif)</span>
          <div className="flex gap-2">
            {EMOJIS.map((emo, i) => {
              const value = i + 1;
              const active = session.emoji === value;
              return (
                <button
                  key={value}
                  disabled={isCoach}
                  onClick={() => patchSession({ emoji: active ? 0 : value })}
                  className={`grid h-11 flex-1 place-items-center rounded-lg border text-2xl transition ${
                    active ? "border-accent bg-accent/15" : "border-line bg-surface"
                  } ${isCoach ? "opacity-60" : ""}`}
                  title={`${value}/5`}
                >
                  {emo}
                </button>
              );
            })}
          </div>
        </div>

        {/* Valider la séance (client) */}
        {!isCoach && session.date && (
          <button
            onClick={() => patchSession({ done: !session.done })}
            className={`mt-3 w-full rounded-xl py-3 font-semibold transition ${
              session.done
                ? "bg-ok text-[#06210a]"
                : "border border-dashed border-ok text-ok"
            }`}
          >
            {session.done ? "✅ Séance validée · toucher pour annuler" : "✅ Valider la séance"}
          </button>
        )}

        <div className="mt-3 space-y-2.5">
          {session.exercises.map((ex, idx) => (
            <ExerciseBlock
              key={ex.uid}
              ex={ex}
              index={idx}
              total={session.exercises.length}
              video={videoById[ex.exId]}
              isCoach={isCoach}
              isPace={paceExIds.has(ex.exId)}
              onPatch={(patch) => patchEx(ex.uid, patch)}
              onRemove={() => removeExercise(ex.uid)}
              onMove={(dir) => moveExercise(ex.uid, dir)}
            />
          ))}
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

function ExerciseBlock({
  ex,
  index,
  total,
  video,
  isCoach,
  isPace,
  onPatch,
  onRemove,
  onMove,
}: {
  ex: ExerciseInstance;
  index: number;
  total: number;
  video?: string;
  isPace?: boolean;
  isCoach: boolean;
  onPatch: (patch: Partial<ExerciseInstance>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface2 p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="font-bold">{ex.name}</span>
          {video && (
            <a href={video} target="_blank" rel="noreferrer" className="ml-2 text-[13px] text-accent2">▶ vidéo</a>
          )}
        </div>
        {isCoach && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={index === 0}
              className="grid h-7 w-7 place-items-center rounded text-dim disabled:opacity-20 hover:text-ink"
              aria-label="Monter"
            >▲</button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              className="grid h-7 w-7 place-items-center rounded text-dim disabled:opacity-20 hover:text-ink"
              aria-label="Descendre"
            >▼</button>
            <button
              onClick={onRemove}
              className="ml-0.5 rounded-lg bg-surface px-2.5 py-1 text-[13px] text-dim hover:text-danger"
            >✕</button>
          </div>
        )}
      </div>

      {/* Prescription — éditable coach / lecture seule client */}
      {isCoach ? (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[13px] text-dim">Séries</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="3 ou 2-4"
                value={ex.setsLabel ?? (ex.sets || "")}
                onChange={(e) => {
                  const raw = e.target.value;
                  const num = parseInt(raw.split("-")[0], 10);
                  onPatch({ setsLabel: raw, sets: isNaN(num) ? 0 : num });
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] text-dim">Répétitions</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="10 ou 8-12"
                value={ex.repsLabel ?? (ex.reps || "")}
                onChange={(e) => {
                  const raw = e.target.value;
                  const num = parseInt(raw.split("-")[0], 10);
                  onPatch({ repsLabel: raw, reps: isNaN(num) ? 0 : num });
                }}
              />
            </label>
          </div>
          <div className="mt-2.5">
            <span className="mb-1 block text-[13px] text-dim">{isPace ? "Allure (min/km)" : "Poids (kg)"}</span>
            <input
              type="number"
              min={0}
              step={isPace ? 0.05 : 1}
              placeholder={isPace ? "ex : 4.5 → 4 min 30 s/km" : "0"}
              value={ex.weight || ""}
              onChange={(e) => onPatch({ weight: +e.target.value || 0 })}
            />
          </div>
          <div className="mt-2.5">
            <span className="mb-1 block text-[13px] text-dim">RPE coach (0 – 10)</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="ex : 7, 7/8, ~8"
                value={ex.rpeCoach ?? ""}
                onChange={(e) => onPatch({ rpeCoach: e.target.value })}
                className="flex-1"
              />
              {ex.rpeCoach ? (
                <span className="shrink-0 rounded-lg bg-accent/15 px-2.5 py-1 text-sm font-bold text-accent">
                  {ex.rpeCoach}
                </span>
              ) : null}
            </div>
            <RpeGauge value={ex.rpeCoach} />
          </div>
          <label className="mt-2.5 block">
            <span className="mb-1 block text-[13px] text-dim">Commentaire coach</span>
            <textarea
              value={ex.coachComment ?? ""}
              onChange={(e) => onPatch({ coachComment: e.target.value })}
              placeholder="Consigne technique, points de vigilance…"
              className="min-h-[56px]"
            />
          </label>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span><strong>{ex.setsLabel ?? ex.sets}</strong> × <strong>{ex.repsLabel ?? ex.reps}</strong> reps</span>
            {ex.weight > 0 && <span className="text-dim">{isPace ? `${ex.weight} min/km` : `${ex.weight} kg`}</span>}
          </div>
          {(ex.coachComment ?? "") && (
            <p className="mt-1.5 rounded-lg bg-surface p-2 text-[13px]"><span className="text-dim">Coach : </span>{ex.coachComment}</p>
          )}
          {/* RPE prescrit par le coach — affiché au client */}
          {!!ex.rpeCoach && ex.rpeCoach !== 0 && (
            <div className="mt-2.5 rounded-xl border border-line bg-surface p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[13px] text-dim">RPE prescrit</span>
                <span className="rounded-lg bg-accent/15 px-2.5 py-1 text-sm font-bold text-accent">
                  {ex.rpeCoach}
                </span>
              </div>
              <RpeGauge value={ex.rpeCoach} />
            </div>
          )}
        </>
      )}

      {/* RPE client + échec — éditable client / lecture seule coach */}
      <div className="mt-2.5">
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-[13px] text-dim">RPE sportif</span>
          {ex.failed ? (
            <span className="rounded-lg bg-danger/20 px-2.5 py-1 text-sm font-bold text-danger">❌ Raté</span>
          ) : (
            <span className={`rounded-lg px-2.5 py-1 text-sm font-bold ${ex.rpeClient ? "bg-accent2 text-[#06121f]" : "bg-surface text-dim"}`}>
              {ex.rpeClient ? `${ex.rpeClient}/10` : "—"}
            </span>
          )}
          {!isCoach && !ex.failed && (
            <input type="range" min={0} max={10} step={1} value={ex.rpeClient} onChange={(e) => onPatch({ rpeClient: +e.target.value })} className="flex-1" />
          )}
          {!isCoach && (
            <button
              type="button"
              onClick={() => onPatch({ failed: !ex.failed, ...(ex.failed ? {} : { rpeClient: 0 }) })}
              title={ex.failed ? "Retirer l'échec" : "Marquer comme raté"}
              className={`shrink-0 rounded-lg px-2 py-1 text-[13px] transition ${ex.failed ? "bg-danger text-white" : "bg-surface2 text-dim hover:text-danger"}`}
            >
              ❌
            </button>
          )}
        </div>
        {/* Jauge RPE client */}
        {ex.rpeClient > 0 && !ex.failed && <RpeGauge value={ex.rpeClient} />}
      </div>

      {/* Commentaire client */}
      {isCoach ? (
        ex.clientComment ? (
          <p className="mt-2 rounded-lg bg-surface p-2 text-[13px]"><span className="text-dim">Sportif : </span>{ex.clientComment}</p>
        ) : null
      ) : (
        <label className="mt-2.5 block">
          <span className="mb-1 block text-[13px] text-dim">Commentaire sportif</span>
          <textarea
            value={ex.clientComment}
            onChange={(e) => onPatch({ clientComment: e.target.value })}
            placeholder="Ressenti, douleur, charge trop lourde/légère…"
            className="min-h-[60px]"
          />
        </label>
      )}
    </div>
  );
}
