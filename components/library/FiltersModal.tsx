"use client";

import { useData } from "@/components/DataProvider";
import type { FilterCategory } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 9);

export default function FiltersModal({
  categories,
  onClose,
}: {
  categories: FilterCategory[];
  onClose: () => void;
}) {
  const { update } = useData();

  const renameCategory = (catId: string, name: string) =>
    update((s) => {
      const c = s.library.categories.find((c) => c.id === catId);
      if (c) c.name = name;
    });

  const deleteCategory = (catId: string) =>
    update((s) => {
      s.library.categories = s.library.categories.filter((c) => c.id !== catId);
      // nettoie les tags des exercices
      s.library.exercises.forEach((e) => delete e.tags[catId]);
    });

  const addCategory = () =>
    update((s) => {
      s.library.categories.push({ id: uid(), name: "Nouvelle catégorie", options: [] });
    });

  const addOption = (catId: string) =>
    update((s) => {
      s.library.categories.find((c) => c.id === catId)?.options.push({ id: uid(), label: "Nouvelle option" });
    });

  const renameOption = (catId: string, optId: string, label: string) =>
    update((s) => {
      const o = s.library.categories.find((c) => c.id === catId)?.options.find((o) => o.id === optId);
      if (o) o.label = label;
    });

  const deleteOption = (catId: string, optId: string) =>
    update((s) => {
      const c = s.library.categories.find((c) => c.id === catId);
      if (c) c.options = c.options.filter((o) => o.id !== optId);
      s.library.exercises.forEach((e) => {
        if (e.tags[catId] === optId) delete e.tags[catId];
      });
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">Gérer les filtres</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>
        <p className="mb-4 text-sm text-dim">
          Chaque catégorie devient une ligne de filtres. Modifie les noms, ajoute/supprime options et catégories.
        </p>

        <div className="space-y-3">
          {categories.map((cat) => (
            <div key={cat.id} className="rounded-xl border border-line bg-surface2 p-3">
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={cat.name}
                  onChange={(e) => renameCategory(cat.id, e.target.value)}
                  className="font-semibold"
                />
                <button
                  onClick={() => deleteCategory(cat.id)}
                  className="shrink-0 rounded-lg bg-danger px-3 py-2 text-[13px] font-semibold text-white"
                >
                  Suppr.
                </button>
              </div>
              <div className="space-y-2">
                {cat.options.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input value={opt.label} onChange={(e) => renameOption(cat.id, opt.id, e.target.value)} />
                    <button
                      onClick={() => deleteOption(cat.id, opt.id)}
                      className="shrink-0 rounded-lg bg-surface px-2.5 py-2 text-[13px]"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => addOption(cat.id)}
                className="mt-2 rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-dim"
              >
                + Option
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addCategory}
          className="mt-4 w-full rounded-xl border border-dashed border-line py-3 font-semibold text-dim"
        >
          + Ajouter une catégorie de filtre
        </button>
      </div>
    </div>
  );
}
