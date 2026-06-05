"use client";

import { useState } from "react";
import ExerciseMultiSelect from "./ExerciseMultiSelect";

/** Modale de sélection multiple d'exercices depuis la bibliothèque. */
export default function ExercisePicker({
  onConfirm,
  onClose,
}: {
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

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

        <button
          disabled={picked.length === 0}
          onClick={() => {
            onConfirm(picked);
            onClose();
          }}
          className="mt-4 w-full rounded-xl bg-ok py-3 font-semibold text-[#06210a] disabled:opacity-50"
        >
          Ajouter {picked.length > 0 ? `(${picked.length})` : ""}
        </button>
      </div>
    </div>
  );
}
