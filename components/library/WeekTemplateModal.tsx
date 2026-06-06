"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import type { WeekTemplate, WeekTemplateDay } from "@/lib/types";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const uid = () => crypto.randomUUID();

const blank = (): WeekTemplate => ({
  id: uid(),
  name: "",
  description: "",
  days: [],
});

export default function WeekTemplateModal({
  template,
  onClose,
}: {
  template: WeekTemplate | null;
  onClose: () => void;
}) {
  const { templates, updateTemplates } = useData();
  const { sessionTemplates } = templates;

  const [draft, setDraft] = useState<WeekTemplate>(
    template ? structuredClone(template) : blank()
  );

  const isCreating = !template;

  function getDay(dayIndex: number): WeekTemplateDay | undefined {
    return draft.days.find((d) => d.dayIndex === dayIndex);
  }

  function addSession(dayIndex: number, tplId: string) {
    setDraft((prev) => {
      const days = structuredClone(prev.days);
      const existing = days.find((d) => d.dayIndex === dayIndex);
      if (existing) {
        existing.sessions.push({ tplId });
      } else {
        days.push({ dayIndex, sessions: [{ tplId }] });
        days.sort((a, b) => a.dayIndex - b.dayIndex);
      }
      return { ...prev, days };
    });
  }

  function removeSession(dayIndex: number, sessionIdx: number) {
    setDraft((prev) => {
      const days = structuredClone(prev.days).map((d) => {
        if (d.dayIndex !== dayIndex) return d;
        return { ...d, sessions: d.sessions.filter((_, i) => i !== sessionIdx) };
      }).filter((d) => d.sessions.length > 0);
      return { ...prev, days };
    });
  }

  function save() {
    if (!draft.name.trim()) return;
    updateTemplates((t) => {
      const i = t.weekTemplates.findIndex((w) => w.id === draft.id);
      if (i >= 0) t.weekTemplates[i] = draft;
      else t.weekTemplates.unshift(draft);
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
            {isCreating ? "Nouvelle semaine type" : "Modifier la semaine type"}
          </h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>

        {/* Nom */}
        <label className="mb-3 block">
          <span className="mb-1 block text-[13px] text-dim">Nom</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Ex : Semaine Push / Pull / Legs"
            autoFocus
          />
        </label>

        {/* Description */}
        <label className="mb-4 block">
          <span className="mb-1 block text-[13px] text-dim">Description (optionnel)</span>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Objectif de la semaine, type de programme…"
            className="min-h-[56px]"
          />
        </label>

        {/* Grille 7 jours */}
        <div className="mb-4 space-y-2">
          <span className="text-[13px] font-semibold text-dim">Organisation de la semaine</span>

          {sessionTemplates.length === 0 && (
            <p className="rounded-xl border border-line bg-surface2 p-3 text-[13px] text-dim">
              Aucune séance type disponible. Créez d&apos;abord des séances types dans l&apos;onglet &quot;Séances types&quot;.
            </p>
          )}

          {DAYS.map((dayName, dayIndex) => {
            const day = getDay(dayIndex);
            const sessions = day?.sessions ?? [];
            return (
              <div key={dayIndex} className="rounded-xl border border-line bg-surface2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold">{dayName}</span>
                  {sessionTemplates.length > 0 && (
                    <select
                      className="max-w-[200px] text-[13px]"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) addSession(dayIndex, e.target.value);
                      }}
                    >
                      <option value="">+ Ajouter une séance</option>
                      {sessionTemplates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {sessions.length === 0 ? (
                  <p className="text-[12px] text-dim">Repos / aucune séance</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {sessions.map((s, idx) => {
                      const tpl = sessionTemplates.find((t) => t.id === s.tplId);
                      return (
                        <span
                          key={idx}
                          className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-white"
                          style={{ background: tpl?.color ?? "#666" }}
                        >
                          {tpl?.name ?? "Séance supprimée"}
                          <button
                            type="button"
                            onClick={() => removeSession(dayIndex, idx)}
                            className="ml-0.5 opacity-80 hover:opacity-100"
                          >✕</button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={save}
          disabled={!draft.name.trim()}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500] disabled:opacity-40"
        >
          {isCreating ? "Créer la semaine type" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
