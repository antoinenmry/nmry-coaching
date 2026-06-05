"use client";

import { countdownLabel, daysUntil, frenchDate } from "@/lib/dates";
import type { Goal } from "@/lib/types";

/** Fiche objectif en lecture seule (utilisée depuis le planning). */
export default function GoalInfoModal({ goals, onClose }: { goals: Goal[]; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">🎯 Objectif{goals.length > 1 ? "s" : ""}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>

        <div className="space-y-3">
          {goals.map((g) => {
            const n = daysUntil(g.date);
            const future = n !== null && n >= 0;
            return (
              <div key={g.id} className="rounded-xl border border-line bg-surface2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-base">{g.competition}</strong>
                  <span className={`rounded-full px-2.5 py-1 text-[13px] font-bold ${future ? "bg-ok/20 text-ok" : "bg-surface text-dim"}`}>
                    {countdownLabel(g.date)}
                  </span>
                </div>
                <div className="mt-1 text-[13px] text-dim">
                  {frenchDate(g.date)}
                  {g.place && ` · ${g.place}`}
                </div>
                {g.expected && (
                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    <span className="text-dim">Perfs visées : </span>
                    {g.expected}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
