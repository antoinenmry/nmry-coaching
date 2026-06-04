"use client";

import { useData } from "./DataProvider";
import { EXERCISE_BY_ID, EXERCISES } from "@/lib/data";
import type { ExerciseInstance, SessionInstance } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 9);

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
  const { update } = useData();

  const patchEx = (exUid: string, patch: Partial<ExerciseInstance>) =>
    update((d) => {
      const s = d.planning[dateKey]?.find((x) => x.id === session.id);
      const ex = s?.exercises.find((e) => e.uid === exUid);
      if (ex) Object.assign(ex, patch);
    });

  const addExercise = (exId: string) =>
    update((d) => {
      const s = d.planning[dateKey]?.find((x) => x.id === session.id);
      s?.exercises.push({ uid: uid(), exId, sets: 3, reps: 10, weight: 20, rpe: 8, validated: false });
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

        <div className="mt-4 space-y-2.5">
          {session.exercises.map((ex) => (
            <ExerciseBlock
              key={ex.uid}
              ex={ex}
              onPatch={(patch) => patchEx(ex.uid, patch)}
              onRemove={() => removeExercise(ex.uid)}
            />
          ))}
        </div>

        <AddExercise onAdd={addExercise} />

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
  onPatch,
  onRemove,
}: {
  ex: ExerciseInstance;
  onPatch: (patch: Partial<ExerciseInstance>) => void;
  onRemove: () => void;
}) {
  const name = EXERCISE_BY_ID[ex.exId]?.name ?? ex.exId;

  return (
    <div className="rounded-xl border border-line bg-surface2 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-bold">{name}</span>
        <button onClick={onRemove} className="rounded-lg bg-surface px-2.5 py-1 text-[13px]">
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
          <input
            type="range"
            min={0}
            max={300}
            step={1}
            value={ex.weight}
            onChange={(e) => onPatch({ weight: +e.target.value })}
            className="flex-1"
          />
          <input
            type="number"
            min={0}
            value={ex.weight}
            onChange={(e) => onPatch({ weight: +e.target.value || 0 })}
            className="w-20"
          />
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="text-[13px] text-dim">RPE (coach)</span>
        <span className="rounded-lg bg-accent px-2.5 py-1 text-sm font-bold text-[#1a1500]">{ex.rpe}/10</span>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={ex.rpe}
          onChange={(e) => onPatch({ rpe: +e.target.value })}
          className="flex-1"
        />
      </div>

      <label
        className={`mt-2.5 flex items-center gap-2 rounded-lg border bg-surface p-2.5 ${
          ex.validated ? "border-ok" : "border-line"
        }`}
      >
        <input type="checkbox" checked={ex.validated} onChange={(e) => onPatch({ validated: e.target.checked })} />
        <span>Validé par le client</span>
      </label>
    </div>
  );
}

function AddExercise({ onAdd }: { onAdd: (exId: string) => void }) {
  return (
    <div className="mt-2.5 flex gap-2">
      <select id="add-ex" className="flex-1" defaultValue={EXERCISES[0].id}>
        {EXERCISES.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} · {e.group}
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
