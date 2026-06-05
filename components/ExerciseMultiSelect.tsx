"use client";

import { useMemo, useState } from "react";
import { useData } from "./DataProvider";

/** Filtres (par catégorie) + liste d'exercices de la bibliothèque à cocher. Contrôlé. */
export default function ExerciseMultiSelect({
  picked,
  onToggle,
}: {
  picked: string[];
  onToggle: (id: string) => void;
}) {
  const { state } = useData();
  const { categories, exercises } = state.library;
  const [sel, setSel] = useState<Record<string, string | null>>({});

  const filtered = useMemo(
    () =>
      exercises.filter((ex) =>
        categories.every((c) => {
          const s = sel[c.id];
          return !s || ex.tags[c.id] === s;
        }),
      ),
    [exercises, categories, sel],
  );

  return (
    <div>
      {/* Filtres */}
      <div className="mb-3 space-y-1.5">
        {categories.map((cat) => (
          <div key={cat.id} className="flex flex-wrap gap-1.5">
            <Chip active={!sel[cat.id]} label="Tous" onClick={() => setSel((s) => ({ ...s, [cat.id]: null }))} />
            {cat.options.map((o) => (
              <Chip
                key={o.id}
                active={sel[cat.id] === o.id}
                label={o.label}
                onClick={() => setSel((s) => ({ ...s, [cat.id]: s[cat.id] === o.id ? null : o.id }))}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-dim">
          Aucun exercice. Crée-en dans l&apos;onglet Bibliothèque.
        </p>
      ) : (
        <div className="max-h-[42vh] space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((ex) => {
            const on = picked.includes(ex.id);
            return (
              <button
                key={ex.id}
                onClick={() => onToggle(ex.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left ${
                  on ? "border-ok bg-ok/10" : "border-line bg-surface2"
                }`}
              >
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-xs font-bold ${
                    on ? "border-ok bg-ok text-[#06210a]" : "border-line text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className="font-medium">{ex.name}</span>
                {ex.video && <span className="ml-auto text-[12px] text-accent2">▶</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[13px] ${
        active ? "border-accent bg-accent/15 text-accent" : "border-line bg-surface2 text-ink"
      }`}
    >
      {label}
    </button>
  );
}
