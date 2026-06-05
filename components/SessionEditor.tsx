"use client";

import { useState } from "react";
import { useData } from "./DataProvider";
import ExercisePicker from "./ExercisePicker";
import { exerciseInstanceFromLibrary, SESSION_COLORS } from "@/lib/data";
import type { ExerciseInstance, Role } from "@/lib/types";

const EMOJIS = ["😫", "😕", "😐", "🙂", "🤩"]; // ressenti 1 → 5

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
  const { update, state } = useData();
  const session = state.sessions.find((s) => s.id === sessionId);
  const [picking, setPicking] = useState(false);

  const videoById = Object.fromEntries(state.library.exercises.map((e) => [e.id, e.video]));
  const isCoach = role === "coach";

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

  const addExercises = (ids: string[]) =>
    update((d) => {
      const s = d.sessions.find((x) => x.id === sessionId);
      if (!s) return;
      ids.forEach((id) => {
        const libEx = d.library.exercises.find((e) => e.id === id);
        s.exercises.push(exerciseInstanceFromLibrary({ id, name: libEx?.name ?? "Exercice" }));
      });
    });

  const removeExercise = (exUid: string) =>
    update((d) => {
      const s = d.sessions.find((x) => x.id === sessionId);
      if (s) s.exercises = s.exercises.filter((e) => e.uid !== exUid);
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
      onClick={(e) => e.target === e.currentTarget && onClose()}
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

        {/* Ressenti séance (client) */}
        <div className="mt-3 rounded-xl border border-line bg-surface2 p-3">
          <span className="mb-2 block text-[13px] text-dim">Ressenti de la séance (client)</span>
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

        <div className="mt-3 space-y-2.5">
          {session.exercises.map((ex) => (
            <ExerciseBlock
              key={ex.uid}
              ex={ex}
              video={videoById[ex.exId]}
              isCoach={isCoach}
              onPatch={(patch) => patchEx(ex.uid, patch)}
              onRemove={() => removeExercise(ex.uid)}
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
            {picking && <ExercisePicker onConfirm={addExercises} onClose={() => setPicking(false)} />}
            <button onClick={deleteSession} className="mt-4 w-full rounded-xl bg-danger py-3 font-semibold text-white">
              Supprimer la séance
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ExerciseBlock({
  ex,
  video,
  isCoach,
  onPatch,
  onRemove,
}: {
  ex: ExerciseInstance;
  video?: string;
  isCoach: boolean;
  onPatch: (patch: Partial<ExerciseInstance>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface2 p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-bold">{ex.name}</span>
          {video && (
            <a href={video} target="_blank" rel="noreferrer" className="ml-2 text-[13px] text-accent2">▶ vidéo</a>
          )}
        </div>
        {isCoach && (
          <button onClick={onRemove} className="shrink-0 rounded-lg bg-surface px-2.5 py-1 text-[13px]">✕</button>
        )}
      </div>

      {/* Prescription — éditable coach / lecture seule client */}
      {isCoach ? (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[13px] text-dim">Séries</span>
              <input type="number" min={0} value={ex.sets} onChange={(e) => onPatch({ sets: +e.target.value || 0 })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] text-dim">Répétitions</span>
              <input type="number" min={0} value={ex.reps} onChange={(e) => onPatch({ reps: +e.target.value || 0 })} />
            </label>
          </div>
          <div className="mt-2.5">
            <span className="mb-1 block text-[13px] text-dim">Poids (kg)</span>
            <div className="flex items-center gap-2.5">
              <input type="range" min={0} max={300} step={1} value={ex.weight} onChange={(e) => onPatch({ weight: +e.target.value })} className="flex-1" />
              <input type="number" min={0} value={ex.weight} onChange={(e) => onPatch({ weight: +e.target.value || 0 })} className="w-20" />
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="w-24 shrink-0 text-[13px] text-dim">RPE coach</span>
            <span className="rounded-lg bg-accent px-2.5 py-1 text-sm font-bold text-[#1a1500]">{ex.rpeCoach}/10</span>
            <input type="range" min={1} max={10} step={1} value={ex.rpeCoach} onChange={(e) => onPatch({ rpeCoach: +e.target.value })} className="flex-1" />
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span><strong>{ex.sets}</strong> × <strong>{ex.reps}</strong> reps</span>
          <span className="text-dim">{ex.weight} kg</span>
          <span className="text-dim">RPE coach {ex.rpeCoach}/10</span>
        </div>
      )}

      {/* RPE client — éditable client / lecture seule coach */}
      <div className="mt-2.5 flex items-center gap-2">
        <span className="w-24 shrink-0 text-[13px] text-dim">RPE client</span>
        <span className={`rounded-lg px-2.5 py-1 text-sm font-bold ${ex.rpeClient ? "bg-accent2 text-[#06121f]" : "bg-surface text-dim"}`}>
          {ex.rpeClient ? `${ex.rpeClient}/10` : "—"}
        </span>
        {!isCoach && (
          <input type="range" min={0} max={10} step={1} value={ex.rpeClient} onChange={(e) => onPatch({ rpeClient: +e.target.value })} className="flex-1" />
        )}
      </div>

      {/* Commentaire client */}
      {isCoach ? (
        ex.clientComment ? (
          <p className="mt-2 rounded-lg bg-surface p-2 text-[13px]"><span className="text-dim">Client : </span>{ex.clientComment}</p>
        ) : null
      ) : (
        <label className="mt-2.5 block">
          <span className="mb-1 block text-[13px] text-dim">Commentaire client</span>
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
