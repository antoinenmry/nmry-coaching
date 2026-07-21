"use client";

import { useMemo, useState } from "react";
import { useData } from "./DataProvider";

/** Filtres (par catégorie) + liste d'exercices de la bibliothèque avec compteur. Contrôlé.
 *  `picked` peut contenir plusieurs fois le même id (= même exercice ajouté plusieurs fois). */
export default function ExerciseMultiSelect({
  picked,
  onAdd,
  onRemove,
  showFilters = true,
  activeColorFilter,
}: {
  picked: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  showFilters?: boolean;
  /** Si fourni par le parent, ce filtre couleur est utilisé à la place de l'UI interne */
  activeColorFilter?: string[];
}) {
  const { library } = useData();
  const { categories, exercises } = library;
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  // Liste repliée par défaut (mur d'exercices évité) — la recherche/les filtres
  // restent natifs et toujours visibles. Se déroule au tap du bouton, ou
  // automatiquement dès qu'on tape une recherche.
  const [listOpen, setListOpen] = useState(false);
  const showList = listOpen || search.trim() !== "";
  // Filtre couleur interne (utilisé seulement si activeColorFilter n'est pas fourni)
  const [colorFilter, setColorFilter] = useState<string[]>([]);

  const toggleColorFilter = (hex: string) =>
    setColorFilter((prev) =>
      prev.includes(hex) ? prev.filter((c) => c !== hex) : [...prev, hex]
    );

  // Filtre effectif : externe si fourni, interne sinon
  const effectiveColorFilter = activeColorFilter !== undefined ? activeColorFilter : colorFilter;

  /** Couleurs effectivement utilisées — pour l'UI interne uniquement */
  const usedColors = useMemo(() => {
    if (activeColorFilter !== undefined) return []; // pas d'UI interne
    const set = new Set<string>();
    categories.forEach((cat) => cat.options.forEach((o) => { if (o.color) set.add(o.color); }));
    return Array.from(set);
  }, [categories, activeColorFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

    // Option IDs des couleurs sélectionnées (pour filtre transversal)
    let colorOptionIds: Set<string> | null = null;
    if (effectiveColorFilter.length > 0) {
      colorOptionIds = new Set<string>();
      categories.forEach((cat) =>
        cat.options.forEach((o) => {
          if (o.color && effectiveColorFilter.includes(o.color)) colorOptionIds!.add(o.id);
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
  }, [exercises, categories, sel, search, effectiveColorFilter]);

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

      {/* Toggle liste — recherche/filtres restent natifs, seule la liste se replie */}
      <button
        type="button"
        onClick={() => setListOpen((v) => !v)}
        className="mb-1.5 flex w-full items-center justify-between rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-sm font-semibold text-ink"
      >
        <span>
          📚 Voir la bibliothèque
          {picked.length > 0 ? ` (${picked.length} sélectionné${picked.length > 1 ? "s" : ""})` : ""}
        </span>
        <span className="text-dim">{showList ? "▲" : "▼"}</span>
      </button>

      {/* Liste */}
      {!showList ? null : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-dim">
          Aucun exercice. Crée-en dans l&apos;onglet Bibliothèque.
        </p>
      ) : (
        <div className="max-h-[42vh] space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((ex) => {
            const count = picked.reduce((n, id) => (id === ex.id ? n + 1 : n), 0);
            const on = count > 0;
            return (
              <div
                key={ex.id}
                className={`flex w-full items-center gap-2.5 rounded-lg border p-2 text-left ${
                  on ? "border-ok bg-ok/10" : "border-line bg-surface2"
                }`}
              >
                {/* Nom : tap = +1 (ajoute une occurrence) */}
                <button type="button" onClick={() => onAdd(ex.id)} className="flex min-w-0 flex-1 items-center gap-2.5 py-0.5 text-left">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold ${
                      on ? "border-ok bg-ok text-[#06210a]" : "border-line text-dim"
                    }`}
                  >
                    {on ? count : "+"}
                  </span>
                  <span className="truncate font-medium">{ex.name}</span>
                  {ex.video && <span className="text-[12px] text-accent2">▶</span>}
                </button>
                {/* Stepper − / + (visible seulement si ≥1) */}
                {on && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => onRemove(ex.id)} aria-label="Retirer une occurrence"
                      className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-lg text-dim hover:text-danger">−</button>
                    <button type="button" onClick={() => onAdd(ex.id)} aria-label="Ajouter une occurrence"
                      className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-lg text-dim hover:text-ink">+</button>
                  </div>
                )}
              </div>
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
