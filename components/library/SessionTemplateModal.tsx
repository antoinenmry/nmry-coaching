"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import ExercisePicker from "@/components/ExercisePicker";
import { SESSION_COLORS } from "@/lib/data";
import type { SessionTemplate, TemplateExercise } from "@/lib/types";

const uid = () => crypto.randomUUID();

const blank = (): SessionTemplate => ({
  id: uid(),
  name: "",
  color: SESSION_COLORS[0],
  description: "",
  exercises: [],
});

export default function SessionTemplateModal({
  template,
  onClose,
}: {
  template: SessionTemplate | null; // null = création
  onClose: () => void;
}) {
  const { updateTemplates, library } = useData();
  const [draft, setDraft] = useState<SessionTemplate>(
    template ? structuredClone(template) : blank()
  );
  const [picking, setPicking] = useState(false);

  const isCreating = !template;

  function patchEx(uid: string, patch: Partial<TemplateExercise>) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.uid === uid ? { ...e, ...patch } : e)),
    }));
  }

  function removeEx(uid: string) {
    setDraft((d) => ({ ...d, exercises: d.exercises.filter((e) => e.uid !== uid) }));
  }

  function moveEx(uid: string, dir: -1 | 1) {
    setDraft((d) => {
      const exs = [...d.exercises];
      const idx = exs.findIndex((e) => e.uid === uid);
      const target = idx + dir;
      if (target < 0 || target >= exs.length) return d;
      [exs[idx], exs[target]] = [exs[target], exs[idx]];
      return { ...d, exercises: exs };
    });
  }

  function addExercises(libIds: string[], inline: { id: string; name: string }[]) {
    setDraft((d) => {
      const added: TemplateExercise[] = [
        ...libIds.map((id) => {
          const libEx = library.exercises.find((e) => e.id === id);
          return {
            uid: crypto.randomUUID(),
            exId: id,
            name: libEx?.name ?? id,
            sets: 3, reps: 10, weight: 0, rpeCoach: 0, coachComment: "",
          };
        }),
        ...inline.map(({ id, name }) => ({
          uid: crypto.randomUUID(),
          exId: id,
          name,
          sets: 3, reps: 10, weight: 0, rpeCoach: 0, coachComment: "",
        })),
      ];
      return { ...d, exercises: [...d.exercises, ...added] };
    });
  }

  function save() {
    if (!draft.name.trim()) return;
    updateTemplates((t) => {
      const i = t.sessionTemplates.findIndex((s) => s.id === draft.id);
      if (i >= 0) t.sessionTemplates[i] = draft;
      else t.sessionTemplates.unshift(draft);
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {isCreating ? "Nouvelle séance type" : "Modifier la séance type"}
          </h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>

        {/* Nom */}
        <label className="mb-3 block">
          <span className="mb-1 block text-[13px] text-dim">Nom</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Ex : Push — Pecs / Épaules / Triceps"
            autoFocus
          />
        </label>

        {/* Couleur */}
        <div className="mb-3">
          <span className="mb-1.5 block text-[13px] text-dim">Couleur</span>
          <div className="flex gap-2">
            {SESSION_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, color: c }))}
                className={`h-8 w-8 rounded-full border-2 ${draft.color === c ? "border-ink" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        {/* Description */}
        <label className="mb-4 block">
          <span className="mb-1 block text-[13px] text-dim">Description (optionnel)</span>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Objectif de la séance, contexte…"
            className="min-h-[56px]"
          />
        </label>

        {/* Exercices */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-dim">
              Exercices ({draft.exercises.length})
            </span>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="rounded-lg bg-surface2 px-3 py-1.5 text-[13px] font-semibold text-dim hover:text-ink"
            >
              + Ajouter
            </button>
          </div>

          {draft.exercises.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-dim">
              Aucun exercice. Clique sur &quot;+ Ajouter&quot;.
            </p>
          ) : (
            <div className="space-y-2">
              {draft.exercises.map((ex, idx) => (
                <div key={ex.uid} className="rounded-xl border border-line bg-surface2 p-3">
                  {/* En-tête exercice */}
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-semibold">{ex.name}</span>
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => moveEx(ex.uid, -1)} disabled={idx === 0}
                        className="grid h-7 w-7 place-items-center text-dim disabled:opacity-20">▲</button>
                      <button type="button" onClick={() => moveEx(ex.uid, 1)} disabled={idx === draft.exercises.length - 1}
                        className="grid h-7 w-7 place-items-center text-dim disabled:opacity-20">▼</button>
                      <button type="button" onClick={() => removeEx(ex.uid)}
                        className="grid h-7 w-7 place-items-center rounded text-dim hover:text-danger">✕</button>
                    </div>
                  </div>

                  {/* Champs prescription */}
                  <div className="grid grid-cols-3 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-dim">Séries</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="3 ou 2-4"
                        value={ex.setsLabel ?? (ex.sets || "")}
                        onChange={(e) => {
                          const raw = e.target.value;
                          patchEx(ex.uid, { setsLabel: raw, sets: parseInt(raw) || 0 });
                        }}
                        className="text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-dim">Reps</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="10 ou 8-12"
                        value={ex.repsLabel ?? (ex.reps || "")}
                        onChange={(e) => {
                          const raw = e.target.value;
                          patchEx(ex.uid, { repsLabel: raw, reps: parseInt(raw) || 0 });
                        }}
                        className="text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] text-dim">Poids (kg)</span>
                      <input
                        type="number"
                        min={0}
                        value={ex.weight || ""}
                        onChange={(e) => patchEx(ex.uid, { weight: +e.target.value || 0 })}
                        className="text-sm"
                      />
                    </label>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="shrink-0 text-[12px] text-dim w-20">RPE coach</span>
                    <span className={`rounded px-2 py-0.5 text-sm font-bold ${ex.rpeCoach ? "bg-accent text-[#1a1500]" : "bg-surface text-dim"}`}>
                      {ex.rpeCoach ? `${ex.rpeCoach}/10` : "—"}
                    </span>
                    <input type="range" min={0} max={10} step={1} value={ex.rpeCoach}
                      onChange={(e) => patchEx(ex.uid, { rpeCoach: +e.target.value })} className="flex-1" />
                  </div>

                  <label className="mt-2 block">
                    <span className="mb-0.5 block text-[11px] text-dim">Note coach (optionnel)</span>
                    <input
                      value={ex.coachComment}
                      onChange={(e) => patchEx(ex.uid, { coachComment: e.target.value })}
                      placeholder="Consigne, point de vigilance…"
                      className="text-sm"
                    />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={save}
          disabled={!draft.name.trim()}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500] disabled:opacity-40"
        >
          {isCreating ? "Créer la séance type" : "Enregistrer"}
        </button>
      </div>

      {picking && (
        <ExercisePicker
          onConfirm={(libIds, inline) => { addExercises(libIds, inline); setPicking(false); }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
