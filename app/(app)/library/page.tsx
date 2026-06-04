"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import ExerciseModal from "@/components/library/ExerciseModal";
import FiltersModal from "@/components/library/FiltersModal";
import type { LibraryExercise } from "@/lib/types";

export default function LibraryPage() {
  const { state, update, loading } = useData();
  const lib = state.library;

  // catégorie -> option sélectionnée (null = "Tous")
  const [selected, setSelected] = useState<Record<string, string | null>>({});
  const [editing, setEditing] = useState<LibraryExercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [managingFilters, setManagingFilters] = useState(false);

  // Exercices filtrés (tous les filtres actifs combinés)
  const filtered = useMemo(
    () =>
      lib.exercises.filter((ex) =>
        lib.categories.every((cat) => {
          const sel = selected[cat.id];
          return !sel || ex.tags[cat.id] === sel;
        }),
      ),
    [lib.exercises, lib.categories, selected],
  );

  // Compteur facetté : exercices matchant les AUTRES catégories sélectionnées
  function countFor(catId: string, optId: string | null) {
    const base = lib.exercises.filter((ex) =>
      lib.categories.every((c) => {
        if (c.id === catId) return true;
        const sel = selected[c.id];
        return !sel || ex.tags[c.id] === sel;
      }),
    );
    return optId ? base.filter((ex) => ex.tags[catId] === optId).length : base.length;
  }

  if (loading) return <p className="py-10 text-center text-dim">Chargement…</p>;

  return (
    <div>
      {/* En-tête */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">
          📚 Bibliothèque <span className="text-dim">({lib.exercises.length})</span>
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setManagingFilters(true)}
            className="rounded-lg border border-line bg-surface2 px-3 py-2 text-[13px] font-semibold"
          >
            Gérer les filtres
          </button>
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg bg-ok px-3 py-2 text-[13px] font-semibold text-[#06210a]"
          >
            + Créer un exercice
          </button>
        </div>
      </div>

      {/* Lignes de filtres (une par catégorie) */}
      <div className="mb-4 space-y-2">
        {lib.categories.map((cat) => (
          <div key={cat.id} className="flex flex-wrap items-center gap-2">
            <span className="mr-1 w-full text-[11px] uppercase tracking-wide text-dim sm:w-auto">{cat.name}</span>
            <Chip
              active={!selected[cat.id]}
              label="Tous"
              count={countFor(cat.id, null)}
              onClick={() => setSelected((s) => ({ ...s, [cat.id]: null }))}
            />
            {cat.options.map((opt) => (
              <Chip
                key={opt.id}
                active={selected[cat.id] === opt.id}
                label={opt.label}
                count={countFor(cat.id, opt.id)}
                onClick={() =>
                  setSelected((s) => ({ ...s, [cat.id]: s[cat.id] === opt.id ? null : opt.id }))
                }
              />
            ))}
          </div>
        ))}
      </div>

      {/* Cartes exercices */}
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-dim">Aucun exercice pour ces filtres.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((ex) => (
            <ExerciseCard
              key={ex.id}
              ex={ex}
              tagLabels={tagLabels(ex, lib.categories)}
              onEdit={() => setEditing(ex)}
              onDelete={() =>
                update((s) => {
                  s.library.exercises = s.library.exercises.filter((e) => e.id !== ex.id);
                })
              }
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ExerciseModal
          categories={lib.categories}
          exercise={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      {managingFilters && (
        <FiltersModal categories={lib.categories} onClose={() => setManagingFilters(false)} />
      )}
    </div>
  );
}

function tagLabels(ex: LibraryExercise, categories: ReturnType<typeof useData>["state"]["library"]["categories"]) {
  return categories
    .map((c) => c.options.find((o) => o.id === ex.tags[c.id])?.label)
    .filter(Boolean) as string[];
}

function Chip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
        active ? "border-accent bg-accent/15 text-accent" : "border-line bg-surface2 text-ink"
      }`}
    >
      {label}
      <span className={`text-xs ${active ? "text-accent" : "text-dim"}`}>{count}</span>
    </button>
  );
}

function ExerciseCard({
  ex,
  tagLabels,
  onEdit,
  onDelete,
}: {
  ex: LibraryExercise;
  tagLabels: string[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold">{ex.name}</h3>
        <div className="flex shrink-0 gap-1">
          <button onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2" aria-label="Modifier">✏️</button>
          <button onClick={onDelete} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2" aria-label="Supprimer">🗑️</button>
        </div>
      </div>

      {tagLabels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tagLabels.map((t) => (
            <span key={t} className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-dim">{t}</span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-dim">
        <span><strong className="text-ink">{ex.sets}</strong>×<strong className="text-ink">{ex.reps}</strong> reps</span>
        <span>RPE <strong className="text-ink">{ex.rpe}</strong></span>
        {ex.tempo && <span>Tempo {ex.tempo}</span>}
        {ex.rest && <span>Repos {ex.rest}</span>}
      </div>

      {ex.notes && <p className="mt-2 line-clamp-2 text-sm text-dim">{ex.notes}</p>}
      {ex.video && (
        <a href={ex.video} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-accent2">
          ▶ Voir la vidéo
        </a>
      )}
    </div>
  );
}
