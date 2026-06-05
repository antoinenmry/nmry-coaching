"use client";

import { useState } from "react";
import ExerciseMultiSelect from "./ExerciseMultiSelect";
import { useData } from "./DataProvider";

export interface InlineExercise {
  id: string;
  name: string;
}

/** Modale de sélection multiple d'exercices depuis la bibliothèque + création inline. */
export default function ExercisePicker({
  onConfirm,
  onClose,
}: {
  onConfirm: (libIds: string[], inline: InlineExercise[]) => void;
  onClose: () => void;
}) {
  const { update } = useData();
  const [picked, setPicked] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [inlineExercises, setInlineExercises] = useState<InlineExercise[]>([]);
  const [saveToLib, setSaveToLib] = useState(true);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function addInline() {
    const name = newName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    setInlineExercises((prev) => [...prev, { id, name }]);
    setNewName("");
  }

  function removeInline(id: string) {
    setInlineExercises((prev) => prev.filter((e) => e.id !== id));
  }

  function confirm() {
    if (saveToLib && inlineExercises.length > 0) {
      update((d) => {
        inlineExercises.forEach(({ id, name }) => {
          if (!d.library.exercises.find((e) => e.id === id)) {
            d.library.exercises.push({ id, name, tags: {}, video: "" });
          }
        });
      });
    }
    onConfirm(picked, inlineExercises);
    onClose();
  }

  const total = picked.length + inlineExercises.length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Ajouter des exercices</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>

        <ExerciseMultiSelect picked={picked} onToggle={toggle} />

        {/* Création inline */}
        <div className="mt-4 rounded-xl border border-dashed border-line bg-surface2 p-3">
          <p className="mb-2 text-[13px] font-semibold text-dim">Nouvel exercice</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addInline()}
              placeholder="Nom de l'exercice…"
              className="flex-1"
            />
            <button
              onClick={addInline}
              disabled={!newName.trim()}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-[#1a1500] disabled:opacity-40"
            >
              Ajouter
            </button>
          </div>

          {inlineExercises.length > 0 && (
            <>
              <ul className="mt-2.5 space-y-1.5">
                {inlineExercises.map((ex) => (
                  <li key={ex.id} className="flex items-center justify-between rounded-lg bg-surface px-2.5 py-1.5 text-sm">
                    <span className="font-medium">{ex.name}</span>
                    <button onClick={() => removeInline(ex.id)} className="text-dim">✕</button>
                  </li>
                ))}
              </ul>
              <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[13px]">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-xs font-bold transition ${
                    saveToLib ? "border-ok bg-ok text-[#06210a]" : "border-line bg-surface"
                  }`}
                  onClick={() => setSaveToLib((v) => !v)}
                >
                  {saveToLib ? "✓" : ""}
                </span>
                <input type="checkbox" className="sr-only" checked={saveToLib} onChange={(e) => setSaveToLib(e.target.checked)} />
                Ajouter aussi à la bibliothèque
              </label>
            </>
          )}
        </div>

        <button
          disabled={total === 0}
          onClick={confirm}
          className="mt-4 w-full rounded-xl bg-ok py-3 font-semibold text-[#06210a] disabled:opacity-50"
        >
          Ajouter {total > 0 ? `(${total})` : ""}
        </button>
      </div>
    </div>
  );
}
