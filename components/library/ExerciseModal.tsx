"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import type { FilterCategory, LibraryExercise } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 9);

const blank = (): LibraryExercise => ({
  id: uid(),
  name: "",
  tags: {},
  video: "",
});

export default function ExerciseModal({
  categories,
  exercise,
  onClose,
}: {
  categories: FilterCategory[];
  exercise: LibraryExercise | null; // null = création
  onClose: () => void;
}) {
  const { update } = useData();
  const [draft, setDraft] = useState<LibraryExercise>(exercise ? structuredClone(exercise) : blank());
  const set = <K extends keyof LibraryExercise>(key: K, value: LibraryExercise[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleTag = (catId: string, optId: string) =>
    setDraft((d) => {
      const tags = { ...d.tags };
      if (tags[catId] === optId) delete tags[catId];
      else tags[catId] = optId;
      return { ...d, tags };
    });

  function save() {
    if (!draft.name.trim()) return;
    update((s) => {
      const i = s.library.exercises.findIndex((e) => e.id === draft.id);
      if (i >= 0) s.library.exercises[i] = draft;
      else s.library.exercises.unshift(draft);
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{exercise ? "Modifier l'exercice" : "Nouvel exercice"}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>

        <Label text="Nom de l'exercice">
          <input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex : Développé incliné haltères" autoFocus />
        </Label>

        {/* Tags par catégorie */}
        {categories.map((cat) => (
          <div key={cat.id} className="mb-3">
            <p className="mb-1.5 text-xs uppercase tracking-wide text-dim">{cat.name}</p>
            <div className="flex flex-wrap gap-2">
              {cat.options.map((opt) => {
                const active = draft.tags[cat.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleTag(cat.id, opt.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      active ? "border-accent bg-accent/15 text-accent" : "border-line bg-surface2 text-ink"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
              {cat.options.length === 0 && <span className="text-sm text-dim">Aucune option (ajoute-en via « Gérer les filtres »)</span>}
            </div>
          </div>
        ))}

        <Label text="Lien vidéo (démonstration)">
          <input value={draft.video} onChange={(e) => set("video", e.target.value)} placeholder="https://…" />
        </Label>

        <p className="mb-4 text-xs text-dim">
          Les séries, répétitions, RPE et commentaires se règlent dans le plan, au moment d&apos;ajouter
          l&apos;exercice à une séance.
        </p>

        <button onClick={save} className="mt-1 w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500]">
          {exercise ? "Enregistrer" : "Créer l'exercice"}
        </button>
      </div>
    </div>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-dim">{text}</span>
      {children}
    </label>
  );
}
