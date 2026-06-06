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
  comment: "",
});

export default function ExerciseModal({
  categories,
  exercise,
  readOnly = false,
  onClose,
}: {
  categories: FilterCategory[];
  exercise: LibraryExercise | null; // null = création
  readOnly?: boolean;
  onClose: () => void;
}) {
  const { updateLibrary } = useData();
  const [draft, setDraft] = useState<LibraryExercise>(exercise ? structuredClone(exercise) : blank());
  const set = <K extends keyof LibraryExercise>(key: K, value: LibraryExercise[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleTag = (catId: string, optId: string) => {
    if (readOnly) return;
    setDraft((d) => {
      const current = d.tags[catId] ?? [];
      const tags = { ...d.tags };
      if (current.includes(optId)) {
        const next = current.filter((id) => id !== optId);
        if (next.length === 0) delete tags[catId];
        else tags[catId] = next;
      } else {
        tags[catId] = [...current, optId];
      }
      return { ...d, tags };
    });
  };

  function save() {
    if (!draft.name.trim()) return;
    updateLibrary((lib) => {
      const i = lib.exercises.findIndex((e) => e.id === draft.id);
      if (i >= 0) lib.exercises[i] = draft;
      else lib.exercises.unshift(draft);
    });
    onClose();
  }

  const isCreating = !exercise;
  const title = readOnly ? draft.name : (isCreating ? "Nouvel exercice" : "Modifier l'exercice");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>

        {!readOnly && (
          <Label text="Nom de l'exercice">
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex : Développé incliné haltères"
              autoFocus
            />
          </Label>
        )}

        {/* Tags par catégorie */}
        {categories.map((cat) => {
          const activeTags = (draft.tags[cat.id] ?? [])
            .map((tagId) => cat.options.find((o) => o.id === tagId)?.label)
            .filter(Boolean) as string[];

          if (readOnly) {
            return activeTags.length > 0 ? (
              <div key={cat.id} className="mb-3">
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-dim">{cat.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeTags.map((label) => (
                    <span key={label} className="rounded-full bg-surface2 px-3 py-1 text-sm text-ink">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null;
          }

          return (
            <div key={cat.id} className="mb-3">
              <p className="mb-1.5 text-xs uppercase tracking-wide text-dim">{cat.name}</p>
              <div className="flex flex-wrap gap-2">
                {cat.options.map((opt) => {
                  const active = (draft.tags[cat.id] ?? []).includes(opt.id);
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
                {cat.options.length === 0 && (
                  <span className="text-sm text-dim">Aucune option (ajoute-en via « Gérer les filtres »)</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Vidéo */}
        {readOnly ? (
          draft.video ? (
            <a
              href={draft.video}
              target="_blank"
              rel="noreferrer"
              className="mb-3 flex items-center gap-2 rounded-xl bg-accent2/10 px-4 py-3 text-sm font-semibold text-accent2"
            >
              ▶ Voir la vidéo de démonstration
            </a>
          ) : null
        ) : (
          <Label text="Lien vidéo (démonstration)">
            <input value={draft.video} onChange={(e) => set("video", e.target.value)} placeholder="https://…" />
          </Label>
        )}

        {/* Commentaire/Notes */}
        {readOnly ? (
          draft.comment ? (
            <div className="mb-4 rounded-xl bg-surface2 p-3">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-dim">Notes</p>
              <p className="text-sm">{draft.comment}</p>
            </div>
          ) : null
        ) : (
          <Label text="Notes / description (visibles par tous)">
            <textarea
              value={draft.comment ?? ""}
              onChange={(e) => set("comment", e.target.value)}
              placeholder="Description de l'exercice, conseils d'exécution…"
            />
          </Label>
        )}

        {!readOnly && (
          <>
            <p className="mb-4 text-xs text-dim">
              Les séries, répétitions, RPE et commentaires se règlent dans le plan, au moment d&apos;ajouter
              l&apos;exercice à une séance.
            </p>
            <button onClick={save} className="mt-1 w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500]">
              {isCreating ? "Créer l'exercice" : "Enregistrer"}
            </button>
          </>
        )}
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
