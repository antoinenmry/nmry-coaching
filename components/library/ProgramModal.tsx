"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import type { Program } from "@/lib/types";

const LEVELS = ["Débutant", "Intermédiaire", "Avancé"];

const uid = () => crypto.randomUUID();

const blank = (): Program => ({
  id: uid(),
  name: "",
  sport: "",
  level: "Débutant",
  description: "",
  weeks: [],
});

export default function ProgramModal({
  program,
  onClose,
}: {
  program: Program | null;
  onClose: () => void;
}) {
  const { templates, updateTemplates } = useData();
  const { weekTemplates } = templates;

  const [draft, setDraft] = useState<Program>(
    program ? structuredClone(program) : blank()
  );

  const isCreating = !program;

  function addWeek(weekTplId: string) {
    setDraft((prev) => ({ ...prev, weeks: [...prev.weeks, { weekTplId }] }));
  }

  function removeWeek(idx: number) {
    setDraft((prev) => ({ ...prev, weeks: prev.weeks.filter((_, i) => i !== idx) }));
  }

  function moveWeek(idx: number, dir: -1 | 1) {
    setDraft((prev) => {
      const weeks = [...prev.weeks];
      const j = idx + dir;
      if (j < 0 || j >= weeks.length) return prev;
      [weeks[idx], weeks[j]] = [weeks[j], weeks[idx]];
      return { ...prev, weeks };
    });
  }

  function save() {
    if (!draft.name.trim() || !draft.sport.trim()) return;
    updateTemplates((t) => {
      const list = t.programs ?? [];
      const i = list.findIndex((p) => p.id === draft.id);
      if (i >= 0) list[i] = draft;
      else list.unshift(draft);
      t.programs = list;
    });
    onClose();
  }

  const weekName = (id: string) => weekTemplates.find((w) => w.id === id)?.name ?? "Semaine supprimée";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-3xl border-t border-line bg-surface sm:rounded-3xl sm:border">
        {/* Header fixe */}
        <div className="flex shrink-0 items-center justify-between p-5 pb-3">
          <h2 className="text-lg font-bold">
            {isCreating ? "Nouveau programme" : "Modifier le programme"}
          </h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>

        {/* Zone scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {/* Nom */}
          <label className="mb-3 block">
            <span className="mb-1 block text-[13px] text-dim">Nom *</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Ex : CAP 10km — 8 semaines"
              autoFocus
            />
          </label>

          {/* Sport + niveau */}
          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[13px] text-dim">Sport *</span>
              <input
                value={draft.sport}
                onChange={(e) => setDraft((d) => ({ ...d, sport: e.target.value }))}
                placeholder="Ex : Course à pied"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] text-dim">Niveau</span>
              <select value={draft.level} onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value }))}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          </div>

          {/* Description */}
          <label className="mb-4 block">
            <span className="mb-1 block text-[13px] text-dim">Description (optionnel)</span>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Objectifs, public cible, points forts du programme…"
              className="min-h-[56px]"
            />
          </label>

          {/* Enchaînement des semaines */}
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-dim">
                Déroulé ({draft.weeks.length} semaine{draft.weeks.length !== 1 ? "s" : ""})
              </span>
              {weekTemplates.length > 0 && (
                <select
                  className="max-w-[200px] text-[13px]"
                  value=""
                  onChange={(e) => { if (e.target.value) addWeek(e.target.value); }}
                >
                  <option value="">+ Ajouter une semaine</option>
                  {weekTemplates.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              )}
            </div>

            {weekTemplates.length === 0 && (
              <p className="rounded-xl border border-line bg-surface2 p-3 text-[13px] text-dim">
                Aucune semaine type disponible. Créez d&apos;abord des semaines types dans l&apos;onglet &quot;Semaines types&quot;.
              </p>
            )}

            {draft.weeks.length === 0 ? (
              weekTemplates.length > 0 && (
                <p className="rounded-xl border border-dashed border-line bg-surface2 p-3 text-[12px] text-dim">
                  Ajoute des semaines types pour composer le programme. Tu peux répéter une même semaine plusieurs fois.
                </p>
              )
            ) : (
              <ol className="space-y-1.5">
                {draft.weeks.map((w, idx) => (
                  <li key={idx} className="flex items-center gap-2 rounded-xl border border-line bg-surface2 p-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/15 text-[12px] font-bold text-accent">
                      S{idx + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{weekName(w.weekTplId)}</span>
                    <div className="flex shrink-0 gap-0.5">
                      <button type="button" onClick={() => moveWeek(idx, -1)} disabled={idx === 0}
                        className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-[12px] disabled:opacity-30">↑</button>
                      <button type="button" onClick={() => moveWeek(idx, 1)} disabled={idx === draft.weeks.length - 1}
                        className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-[12px] disabled:opacity-30">↓</button>
                      <button type="button" onClick={() => removeWeek(idx)}
                        className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-[12px] hover:bg-danger/20">✕</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Footer fixe */}
        <div className="shrink-0 border-t border-line p-5 pt-3">
          <button
            onClick={save}
            disabled={!draft.name.trim() || !draft.sport.trim()}
            className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500] disabled:opacity-40"
          >
            {isCreating ? "Créer le programme" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
