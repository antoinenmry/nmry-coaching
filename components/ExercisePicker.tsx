"use client";

import { useState } from "react";
import ExerciseMultiSelect from "./ExerciseMultiSelect";
import { useData } from "./DataProvider";
import type { LibraryExercise } from "@/lib/types";

export interface InlineExercise {
  id: string;
  name: string;
  tags: Record<string, string[]>;
  video: string;
}

/** Modale de sélection multiple d'exercices depuis la bibliothèque + création inline. */
export default function ExercisePicker({
  onConfirm,
  onClose,
}: {
  onConfirm: (libIds: string[], inline: InlineExercise[]) => void;
  onClose: () => void;
}) {
  const { updateLibrary, library } = useData();
  const { categories } = library;

  const [picked, setPicked] = useState<string[]>([]);
  const [saveToLib, setSaveToLib] = useState(true);

  // État du formulaire de création inline
  const [newName, setNewName] = useState("");
  const [newTags, setNewTags] = useState<Record<string, string[]>>({});
  const [newVideo, setNewVideo] = useState("");
  const [showTagsForm, setShowTagsForm] = useState(false);

  // Liste des exercices inline créés
  const [inlineExercises, setInlineExercises] = useState<InlineExercise[]>([]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const toggleTag = (catId: string, optId: string) =>
    setNewTags((prev) => {
      const cur = prev[catId] ?? [];
      return {
        ...prev,
        [catId]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId],
      };
    });

  function addInline() {
    const name = newName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    setInlineExercises((prev) => [...prev, { id, name, tags: newTags, video: newVideo }]);
    setNewName("");
    setNewTags({});
    setNewVideo("");
    setShowTagsForm(false);
  }

  function removeInline(id: string) {
    setInlineExercises((prev) => prev.filter((e) => e.id !== id));
  }

  function confirm() {
    if (saveToLib && inlineExercises.length > 0) {
      updateLibrary((lib) => {
        inlineExercises.forEach(({ id, name, tags, video }) => {
          if (!lib.exercises.find((e) => e.id === id)) {
            lib.exercises.push({ id, name, tags, video, comment: "" } satisfies LibraryExercise);
          }
        });
      });
    }
    onConfirm(picked, inlineExercises);
    onClose();
  }

  const total = picked.length + inlineExercises.length;

  // Labels des tags sélectionnés dans le formulaire courant
  const newTagLabels = categories.flatMap((c) =>
    (newTags[c.id] ?? [])
      .map((tagId) => c.options.find((o) => o.id === tagId)?.label)
      .filter(Boolean) as string[],
  );

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

        {/* Sélection depuis la bibliothèque */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ExerciseMultiSelect picked={picked} onToggle={toggle} />
        </div>

        {/* Création inline */}
        <div className="mt-4 shrink-0 rounded-xl border border-dashed border-line bg-surface2 p-3">
          <p className="mb-2 text-[13px] font-semibold text-dim">Nouvel exercice</p>

          {/* Nom + bouton Ajouter */}
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addInline()}
              placeholder="Nom de l'exercice…"
              className="flex-1"
            />
            <button
              onClick={() => {
                if (newName.trim()) setShowTagsForm(true);
              }}
              disabled={!newName.trim()}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-[#1a1500] disabled:opacity-40"
            >
              Détails →
            </button>
          </div>

          {/* Formulaire étendu (tags + vidéo) */}
          {showTagsForm && newName.trim() && (
            <div className="mt-3 space-y-3 border-t border-line/50 pt-3">
              {/* Tags par catégorie */}
              {categories.map((cat) => (
                <div key={cat.id}>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-dim">{cat.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.options.map((opt) => {
                      const active = (newTags[cat.id] ?? []).includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleTag(cat.id, opt.id)}
                          className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
                            active
                              ? "border-accent bg-accent/15 text-accent"
                              : "border-line bg-surface text-ink"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                    {cat.options.length === 0 && (
                      <span className="text-[12px] text-dim">—</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Vidéo */}
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wide text-dim">Lien vidéo (optionnel)</p>
                <input
                  value={newVideo}
                  onChange={(e) => setNewVideo(e.target.value)}
                  placeholder="https://…"
                  className="text-sm"
                />
              </div>

              <button
                type="button"
                onClick={addInline}
                className="w-full rounded-lg bg-ok py-2 text-sm font-semibold text-[#06210a]"
              >
                ✓ Ajouter « {newName.trim()} »
              </button>
            </div>
          )}

          {/* Liste des exercices inline créés */}
          {inlineExercises.length > 0 && (
            <>
              <ul className="mt-2.5 space-y-1.5">
                {inlineExercises.map((ex) => {
                  const labels = categories.flatMap((c) =>
                    (ex.tags[c.id] ?? [])
                      .map((id) => c.options.find((o) => o.id === id)?.label)
                      .filter(Boolean) as string[],
                  );
                  return (
                    <li key={ex.id} className="flex items-center justify-between rounded-lg bg-surface px-2.5 py-1.5 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">{ex.name}</span>
                        {labels.length > 0 && (
                          <span className="ml-2 text-[11px] text-dim">{labels.join(", ")}</span>
                        )}
                        {ex.video && <span className="ml-2 text-[11px] text-accent2">▶</span>}
                      </div>
                      <button onClick={() => removeInline(ex.id)} className="ml-2 shrink-0 text-dim">✕</button>
                    </li>
                  );
                })}
              </ul>
              <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[13px]">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-xs font-bold transition ${
                    saveToLib ? "border-ok bg-ok text-[#06210a]" : "border-line bg-surface"
                  }`}
                  onClick={() => setSaveToLib((v) => !v)}
                >
                  {saveToLib ? "✓" : ""}
                </span>
                <input type="checkbox" className="sr-only" checked={saveToLib} onChange={(e) => setSaveToLib(e.target.checked)} />
                Ajouter aussi à la bibliothèque commune
              </label>
            </>
          )}

          {/* Résumé tags courants (avant d'avoir cliqué "Détails") */}
          {!showTagsForm && newName.trim() && newTagLabels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {newTagLabels.map((l) => (
                <span key={l} className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">{l}</span>
              ))}
            </div>
          )}
        </div>

        <button
          disabled={total === 0}
          onClick={confirm}
          className="mt-4 w-full shrink-0 rounded-xl bg-ok py-3 font-semibold text-[#06210a] disabled:opacity-50"
        >
          Ajouter {total > 0 ? `(${total})` : ""}
        </button>
      </div>
    </div>
  );
}
