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
  const { library } = useData();
  const { categories, exercises } = library;
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return exercises.filter((ex) => {
      if (q) {
        const name = ex.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        if (!name.includes(q)) return false;
      }
      return categories.every((c) => {
        const sels = sel[c.id] ?? [];
        return sels.length === 0 || (ex.tags[c.id] ?? []).some((t) => sels.includes(t));
      });
    });
  }, [exercises, categories, sel, search]);

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

      {/* Filtres */}
      <div className="mb-3 space-y-1.5">
        {categories.map((cat) => (
          <div key={cat.id} className="flex flex-wrap gap-1.5">
            <Chip active={!(sel[cat.id]?.length)} label="Tous" onClick={() => setSel((s) => ({ ...s, [cat.id]: [] }))} />
            {cat.options.map((o) => (
              <Chip
                key={o.id}
                active={(sel[cat.id] ?? []).includes(o.id)}
                label={o.label}
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
