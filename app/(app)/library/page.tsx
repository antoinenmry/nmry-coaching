"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import ExerciseModal from "@/components/library/ExerciseModal";
import FiltersModal from "@/components/library/FiltersModal";
import type { LibraryExercise } from "@/lib/types";

export default function LibraryPage() {
  const { library: lib, updateLibrary, loading, role } = useData();
  const isCoach = role === "coach";

  // catégorie -> options sélectionnées (tableau vide = "Tous")
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<LibraryExercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [managingFilters, setManagingFilters] = useState(false);

  // Exercices filtrés — recherche texte + OR dans une catégorie, AND entre catégories
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return lib.exercises.filter((ex) => {
      if (q) {
        const name = ex.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        if (!name.includes(q)) return false;
      }
      return lib.categories.every((cat) => {
        const sels = selected[cat.id] ?? [];
        return sels.length === 0 || (ex.tags[cat.id] ?? []).some((t) => sels.includes(t));
      });
    });
  }, [lib.exercises, lib.categories, selected, search]);

  // Compteur facetté : exercices matchant les AUTRES catégories sélectionnées
  function countFor(catId: string, optId: string | null) {
    const base = lib.exercises.filter((ex) =>
      lib.categories.every((c) => {
        if (c.id === catId) return true;
        const sels = selected[c.id] ?? [];
        return sels.length === 0 || (ex.tags[c.id] ?? []).some((t) => sels.includes(t));
      }),
    );
    return optId ? base.filter((ex) => (ex.tags[catId] ?? []).includes(optId)).length : base.length;
  }

  if (loading) return <p className="py-10 text-center text-dim">Chargement…</p>;

  return (
    <div>
      {/* En-tête */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">
          📚 Bibliothèque <span className="text-dim">({lib.exercises.length})</span>
        </h2>
        {isCoach && (
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
        )}
      </div>

      {/* Recherche textuelle */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un exercice…"
        className="mb-4 w-full"
      />

      {/* Lignes de filtres (une par catégorie) */}
      <div className="mb-4 space-y-2">
        {lib.categories.map((cat) => (
          <div key={cat.id} className="flex flex-wrap items-center gap-2">
            <span className="mr-1 w-full text-[11px] uppercase tracking-wide text-dim sm:w-auto">{cat.name}</span>
            <Chip
              active={!(selected[cat.id]?.length)}
              label="Tous"
              count={countFor(cat.id, null)}
              onClick={() => setSelected((s) => ({ ...s, [cat.id]: [] }))}
            />
            {cat.options.map((opt) => (
              <Chip
                key={opt.id}
                active={(selected[cat.id] ?? []).includes(opt.id)}
                label={opt.label}
                count={countFor(cat.id, opt.id)}
                onClick={() =>
                  setSelected((s) => {
                    const cur = s[cat.id] ?? [];
                    return {
                      ...s,
                      [cat.id]: cur.includes(opt.id)
                        ? cur.filter((x) => x !== opt.id)
                        : [...cur, opt.id],
                    };
                  })
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
              isCoach={isCoach}
              onEdit={() => setEditing(ex)}
              onDelete={() =>
                updateLibrary((lib) => {
                  lib.exercises = lib.exercises.filter((e) => e.id !== ex.id);
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

function tagLabels(ex: LibraryExercise, categories: ReturnType<typeof useData>["library"]["categories"]) {
  return categories.flatMap((c) =>
    (ex.tags[c.id] ?? []).map((tagId) => c.options.find((o) => o.id === tagId)?.label).filter(Boolean),
  ) as string[];
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
  isCoach,
  onEdit,
  onDelete,
}: {
  ex: LibraryExercise;
  tagLabels: string[];
  isCoach: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold">{ex.name}</h3>
        {isCoach && (
          <div className="flex shrink-0 gap-1">
            <button onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2" aria-label="Modifier">✏️</button>
            <button onClick={onDelete} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2" aria-label="Supprimer">🗑️</button>
          </div>
        )}
      </div>

      {tagLabels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tagLabels.map((t) => (
            <span key={t} className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-dim">{t}</span>
          ))}
        </div>
      )}

      {ex.video && (
        <a href={ex.video} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-accent2">
          ▶ Voir la vidéo
        </a>
      )}
    </div>
  );
}
