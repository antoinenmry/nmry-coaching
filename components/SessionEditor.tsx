"use client";

import { useData } from "./DataProvider";
import type { ExerciseInstance, SessionInstance } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 9);

const EMOJIS = ["😫", "😕", "😐", "🙂", "🤩"]; // ressenti 1 → 5

function frenchDate(key: string) {
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

export default function SessionEditor({
  dateKey,
  session,
  onClose,
}: {
  dateKey: string;
  session: SessionInstance;
  onClose: () => void;
}) {
  const { update, state } = useData();
  const library = state.library.exercises;
  const videoById = Object.fromEntries(library.map((e) => [e.id, e.video]));

  const patchSession = (patch: Partial<SessionInstance>) =>
    update((d) => {
      const s = d.planning[dateKey]?.find((x) => x.id === session.id);
      if (s) Object.assign(s, patch);
    });

  const patchEx = (exUid: string, patch: Partial<ExerciseInstance>) =>
    update((d) => {
      const s = d.planning[dateKey]?.find((x) => x.id === session.id);
      const ex = s?.exercises.find((e) => e.uid === exUid);
      if (ex) Object.assign(ex, patch);
    });

  const addExercise = (exId: string) =>
    update((d) => {
      const libEx = d.library.exercises.find((e) => e.id === exId);
      const s = d.planning[dateKey]?.find((x) => x.id === session.id);
      s?.exercises.push({
        uid: uid(),
        exId,
        name: libEx?.name ?? "Exercice",
        sets: 3,
        reps: 10,
        weight: 20,
        rpeCoach: 8,
        rpeClient: 0,
        clientComment: "",
      });
    });

  const removeExercise = (exUid: string) =>
    update((d) => {
      const s = d.planning[dateKey]?.find((x) => x.id === session.id);
      if (s) s.exercises = s.exercises.filter((e) => e.uid !== exUid);
    });

  const deleteSession = () => {
    update((d) => {
      d.planning[dateKey] = (d.planning[dateKey] ?? []).filter((x) => x.id !== session.id);
      if (d.planning[dateKey].length === 0) delete d.planning[dateKey];
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <button
          onClick={onClose}
          className="float-right grid h-9 w-9 place-items-center rounded-lg bg-surface2"
          aria-label="Fermer"
        >
          ✕
        </button>
        <h2 className="border-l-4 pl-2.5 text-lg font-bold" style={{ borderColor: session.color }}>
          {session.name}
        </h2>
        <p className="mt-1 text-[13px] text-dim">{frenchDate(dateKey)}</p>

        {/* Ressenti global de la séance (client) */}
        <div className="mt-3 rounded-xl border border-line bg-surface2 p-3">
          <span className="mb-2 block text-[13px] text-dim">Ressenti de la séance (client)</span>
          <div className="flex gap-2">
            {EMOJIS.map((emo, i) => {
              const value = i + 1;
              const active = session.emoji === value;
              return (
                <button
                  key={value}
                  onClick={() => patchSession({ emoji: active ? 0 : value })}
                  className={`grid h-11 flex-1 place-items-center rounded-lg border text-2xl transition ${
                    active ? "border-accent bg-accent/15" : "border-line bg-surface"
                  }`}
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
              onPatch={(patch) => patchEx(ex.uid, patch)}
              onRemove={() => removeExercise(ex.uid)}
            />
          ))}
        </div>

        <AddExercise library={library} onAdd={addExercise} />

        <button
          onClick={deleteSession}
          className="mt-4 w-full rounded-xl bg-danger py-3 font-semibold text-white"
        >
          Supprimer la séance
        </button>
      </div>
    </div>
  );
}

function ExerciseBlock({
  ex,
  video,
  onPatch,
  onRemove,
}: {
  ex: ExerciseInstance;
  video?: string;
  onPatch: (patch: Partial<ExerciseInstance>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface2 p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-bold">{ex.name}</span>
          {video && (
            <a href={video} target="_blank" rel="noreferrer" className="ml-2 text-[13px] text-accent2">
              ▶ vidéo
            </a>
          )}
        </div>
        <button onClick={onRemove} className="shrink-0 rounded-lg bg-surface px-2.5 py-1 text-[13px]">
          ✕
        </button>
      </div>

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

      {/* RPE coach */}
      <div className="mt-2.5 flex items-center gap-2">
        <span className="w-24 shrink-0 text-[13px] text-dim">RPE coach</span>
        <span className="rounded-lg bg-accent px-2.5 py-1 text-sm font-bold text-[#1a1500]">{ex.rpeCoach}/10</span>
        <input type="range" min={1} max={10} step={1} value={ex.rpeCoach} onChange={(e) => onPatch({ rpeCoach: +e.target.value })} className="flex-1" />
      </div>

      {/* RPE client */}
      <div className="mt-2.5 flex items-center gap-2">
        <span className="w-24 shrink-0 text-[13px] text-dim">RPE client</span>
        <span className={`rounded-lg px-2.5 py-1 text-sm font-bold ${ex.rpeClient ? "bg-accent2 text-[#06121f]" : "bg-surface text-dim"}`}>
          {ex.rpeClient ? `${ex.rpeClient}/10` : "—"}
        </span>
        <input type="range" min={0} max={10} step={1} value={ex.rpeClient} onChange={(e) => onPatch({ rpeClient: +e.target.value })} className="flex-1" />
      </div>

      <label className="mt-2.5 block">
        <span className="mb-1 block text-[13px] text-dim">Commentaire client</span>
        <textarea
          value={ex.clientComment}
          onChange={(e) => onPatch({ clientComment: e.target.value })}
          placeholder="Ressenti, douleur, charge trop lourde/légère…"
          className="min-h-[60px]"
        />
      </label>
    </div>
  );
}

function AddExercise({
  library,
  onAdd,
}: {
  library: { id: string; name: string }[];
  onAdd: (exId: string) => void;
}) {
  if (library.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-line p-3 text-center text-[13px] text-dim">
        Aucun exercice dans la bibliothèque. Crée-en d&apos;abord dans l&apos;onglet Bibliothèque.
      </p>
    );
  }
  return (
    <div className="mt-2.5 flex gap-2">
      <select id="add-ex" className="flex-1" defaultValue={library[0].id}>
        {library.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          const sel = document.getElementById("add-ex") as HTMLSelectElement;
          onAdd(sel.value);
        }}
        className="rounded-lg bg-surface2 px-3 text-[13px] font-semibold"
      >
        + Exercice
      </button>
    </div>
  );
}
