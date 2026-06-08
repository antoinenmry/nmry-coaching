"use client";

import { useMemo, useState } from "react";
import { useData } from "./DataProvider";

/** Filtres (par catégorie) + liste d'exercices de la bibliothèque à cocher. Contrôlé. */
export default function ExerciseMultiSelect({
  picked,
  onToggle,
  showFilters = true,
}: {
  picked: string[];
  onToggle: (id: string) => void;
  showFilters?: boolean;
}) {
  const { library } = useData();
  const { categories, exercises } = library;
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [colorFilter, setColorFilter] = useState<string[]>([]);

  const toggleColorFilter = (hex: string) =>
    setColorFilter((prev) =>
      prev.includes(hex) ? prev.filter((c) => c !== hex) : [...prev, hex]
    );

  /** Couleurs effectivement utilisées dans les options de filtres */
  const usedColors = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((cat) => cat.options.forEach((o) => { if (o.color) set.add(o.color); }));
    return Array.from(set);
  }, [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

    // Option IDs des couleurs sélectionnées (pour filtre transversal)
    let colorOptionIds: Set<string> | null = null;
    if (colorFilter.length > 0) {
      colorOptionIds = new Set<string>();
      categories.forEach((cat) =>
        cat.options.forEach((o) => {
          if (o.color && colorFilter.includes(o.color)) colorOptionIds!.add(o.id);
        })
      );
    }

    return exercises.filter((ex) => {
      if (q) {
        const name = ex.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        if (!name.includes(q)) return false;
      }
      // Filtre couleur transversal
      if (colorOptionIds) {
        const hasColorTag = categories.some((cat) =>
          (ex.tags[cat.id] ?? []).some((t) => colorOptionIds!.has(t))
        );
        if (!hasColorTag) return false;
      }
      // Filtres par catégorie
      return categories.every((c) => {
        const sels = sel[c.id] ?? [];
        return sels.length === 0 || (ex.tags[c.id] ?? []).some((t) => sels.includes(t));
      });
    });
  }, [exercises, categories, sel, search, colorFilter]);

  return (
    <div>
      {/* Recherche textuelle */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un exercice…"
        className="mb-3 w-full"
      />

      {/* Filtres couleur transversaux — toujours visibles si des couleurs existent */}
      {usedColors.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-dim">Couleur :</span>
          {usedColors.map((hex) => {
            const active = colorFilter.includes(hex);
            return (
              <button
                key={hex}
                onClick={() => toggleColorFilter(hex)}
                title="Filtrer par couleur"
                className={`h-8 w-8 shrink-0 rounded-full transition-all ${
                  active
                    ? "border-[3px] border-white scale-110 shadow-[0_0_0_1px_rgba(255,255,255,0.3)]"
                    : "border-[3px] border-transparent opacity-50 hover:opacity-80"
                }`}
                style={{ background: hex }}
              />
            );
          })}
          {colorFilter.length > 0 && (
            <button
              onClick={() => setColorFilter([])}
              className="rounded-full border border-line px-2.5 py-1 text-[12px] text-dim"
            >
              ✕ Effacer
            </button>
          )}
        </div>
      )}

      {/* Filtres par catégorie */}
      {showFilters && <div className="mb-3 space-y-1.5">
        {categories.map((cat) => (
          <div key={cat.id} className="flex flex-wrap gap-1.5">
            <Chip active={!(sel[cat.id]?.length)} label="Tous" onClick={() => setSel((s) => ({ ...s, [cat.id]: [] }))} />
            {cat.options.map((o) => (
              <Chip
                key={o.id}
                active={(sel[cat.id] ?? []).includes(o.id)}
                label={o.label}
                color={o.color}
                onClick={() =>
                  setSel((s) => {
                    const cur = s[cat.id] ?? [];
                    return {
                      ...s,
                      [cat.id]: cur.includes(o.id)
                        ? cur.filter((x) => x !== o.id)
                        : [...cur, o.id],
                    };
                  })
                }
              />
            ))}
          </div>
        ))}
      </div>}

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

function Chip({ active, label, color, onClick }: { active: boolean; label: string; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] ${
        active ? "border-accent bg-accent/15 text-accent" : "border-line bg-surface2 text-ink"
      }`}
    >
      {color && (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
      )}
      {label}
    </button>
  );
}
