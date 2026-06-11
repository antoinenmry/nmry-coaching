"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import type { SessionInstance, ExerciseInstance } from "@/lib/types";

const uid = () => crypto.randomUUID();
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DOW = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export default function PlaceSessionModal({
  defaultDate,
  onClose,
}: {
  defaultDate?: string; // "YYYY-MM-DD"
  onClose: () => void;
}) {
  const { templates, update } = useData();
  const sessions = templates.sessionTemplates ?? [];
  const [selectedId, setSelectedId] = useState<string>(sessions[0]?.id ?? "");
  const [date, setDate] = useState<string>(defaultDate ?? ymd(new Date()));
  const [search, setSearch] = useState("");
  const [done, setDone] = useState(false);

  const filtered = sessions.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );
  const tpl = sessions.find((s) => s.id === selectedId) ?? null;

  function place() {
    if (!tpl) return;
    const session: SessionInstance = {
      id: uid(),
      tplId: tpl.id,
      name: tpl.name,
      color: tpl.color,
      emoji: 0,
      done: false,
      coachComment: "",
      date,
      exercises: tpl.exercises.map((ex): ExerciseInstance => ({
        uid: uid(),
        exId: ex.exId,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        rpeCoach: ex.rpeCoach,
        rpeClient: 0,
        coachComment: ex.coachComment,
        clientComment: "",
        setsLabel: ex.setsLabel,
        repsLabel: ex.repsLabel,
      })),
    };
    update((d) => { d.sessions.push(session); });
    setDone(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-3xl border-t border-line bg-surface sm:rounded-3xl sm:border">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between p-5 pb-3">
          <h2 className="text-lg font-bold">Placer une séance type</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>

        {done ? (
          <div className="space-y-4 p-5 pt-2 text-center">
            <div className="text-5xl">✅</div>
            <div>
              <p className="font-bold">Séance ajoutée !</p>
              <p className="mt-1 text-[13px] text-dim">
                <span className="inline-block h-2.5 w-2.5 rounded-full mr-1 align-middle" style={{ background: tpl?.color }} />
                <span className="font-semibold">{tpl?.name}</span>
                {" "}— {fmtDate(date)}
              </p>
            </div>
            <button onClick={onClose} className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500]">
              Voir le plan
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-5 pt-2 text-center">
            <p className="text-dim">Aucune séance type disponible.</p>
            <p className="mt-1 text-[13px] text-dim">Crée d&apos;abord des séances types dans la bibliothèque.</p>
          </div>
        ) : (
          <>
            {/* Zone scrollable */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5">
              {/* Recherche */}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une séance…"
                className="mb-3 w-full"
                autoFocus
              />

              {/* Liste séances */}
              <div className="space-y-2 pb-2">
                {filtered.length === 0 && (
                  <p className="py-4 text-center text-[13px] text-dim">Aucune séance trouvée.</p>
                )}
                {filtered.map((s) => {
                  const active = selectedId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        active ? "border-accent/60 bg-accent/8" : "border-line bg-surface2 hover:border-accent/30"
                      }`}
                    >
                      {/* Bande couleur */}
                      <div
                        className="h-12 w-1.5 shrink-0 rounded-full"
                        style={{ background: s.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{s.name}</p>
                        <p className="text-[12px] text-dim">
                          {s.exercises.length} exercice{s.exercises.length !== 1 ? "s" : ""}
                          {s.description ? ` · ${s.description}` : ""}
                        </p>
                        {s.exercises.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {s.exercises.slice(0, 3).map((ex) => (
                              <span key={ex.uid} className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-dim">
                                {ex.name}
                              </span>
                            ))}
                            {s.exercises.length > 3 && (
                              <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-dim">
                                +{s.exercises.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {active && (
                        <div className="shrink-0 grid h-6 w-6 place-items-center rounded-full bg-accent text-[12px] font-bold text-[#1a1500]">✓</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer fixe */}
            <div className="shrink-0 space-y-3 border-t border-line p-5 pt-4">
              <label className="block">
                <span className="mb-1 block text-[13px] text-dim">Date de la séance</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                {date && <span className="mt-1 block text-[12px] text-dim">{fmtDate(date)}</span>}
              </label>
              <button
                onClick={place}
                disabled={!tpl}
                className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500] disabled:opacity-40"
              >
                {tpl ? (
                  <span>
                    Placer <span className="font-bold">« {tpl.name} »</span>
                  </span>
                ) : "Sélectionne une séance"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
