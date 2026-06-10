"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { buildSessionsFromProgram, countProgramSessions, mondayOf } from "@/lib/program";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DOW = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MONTHS = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const fmt = (d: Date) => `${DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

/** Prochain lundi à partir d'aujourd'hui (défaut sensé pour démarrer un programme). */
function nextMonday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const m = mondayOf(d);
  if (m.getTime() < d.getTime()) m.setDate(m.getDate() + 7);
  return ymd(m);
}

export default function InjectProgramModal({
  clientName,
  onClose,
}: {
  clientName: string;
  onClose: () => void;
}) {
  const { templates, update } = useData();
  const programs = templates.programs ?? [];

  const [programId, setProgramId] = useState<string>(programs[0]?.id ?? "");
  const [startDate, setStartDate] = useState<string>(nextMonday());
  const [done, setDone] = useState<{ count: number; missing: number } | null>(null);

  const program = programs.find((p) => p.id === programId) ?? null;

  const totalSessions = useMemo(
    () => (program ? countProgramSessions(program, templates.weekTemplates) : 0),
    [program, templates.weekTemplates],
  );

  // Aperçu des bornes du programme
  const bounds = useMemo(() => {
    if (!program || program.weeks.length === 0) return null;
    const monday = mondayOf(new Date(startDate + "T00:00:00"));
    const end = new Date(monday);
    end.setDate(monday.getDate() + program.weeks.length * 7 - 1);
    return { start: monday, end };
  }, [program, startDate]);

  function inject() {
    if (!program) return;
    const result = buildSessionsFromProgram(
      program,
      templates.weekTemplates,
      templates.sessionTemplates,
      new Date(startDate + "T00:00:00"),
    );
    update((d) => {
      d.sessions.push(...result.sessions);
    });
    setDone({ count: result.sessions.length, missing: result.missingWeeks + result.missingSessions });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">📋 Injecter un programme</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <div className="text-5xl">✅</div>
            <div>
              <p className="font-bold">{done.count} séance{done.count !== 1 ? "s" : ""} ajoutée{done.count !== 1 ? "s" : ""}</p>
              <p className="mt-1 text-[13px] text-dim">au plan de {clientName}.</p>
              {done.missing > 0 && (
                <p className="mt-2 text-[12px] text-danger">
                  ⚠ {done.missing} référence{done.missing !== 1 ? "s" : ""} ignorée{done.missing !== 1 ? "s" : ""} (semaine ou séance type supprimée).
                </p>
              )}
            </div>
            <button onClick={onClose} className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500]">
              Voir le plan
            </button>
          </div>
        ) : programs.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-dim">Aucun programme disponible.</p>
            <p className="mt-1 text-[13px] text-dim">Crée d&apos;abord un programme dans la bibliothèque (onglet Programmes).</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="rounded-xl border border-line bg-surface2 p-3 text-[13px] text-dim">
              Sportif ciblé : <span className="font-semibold text-ink">{clientName}</span>
            </p>

            {/* Choix du programme */}
            <label className="block">
              <span className="mb-1 block text-[13px] text-dim">Programme</span>
              <select value={programId} onChange={(e) => setProgramId(e.target.value)}>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.sport}</option>
                ))}
              </select>
            </label>

            {/* Date de départ */}
            <label className="block">
              <span className="mb-1 block text-[13px] text-dim">Date de départ</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <span className="mt-1 block text-[12px] text-dim">
                Le programme démarre le lundi de cette semaine.
              </span>
            </label>

            {/* Récapitulatif */}
            {program && (
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-[13px]">
                <div className="flex justify-between"><span className="text-dim">Semaines</span><span className="font-semibold">{program.weeks.length}</span></div>
                <div className="flex justify-between"><span className="text-dim">Séances générées</span><span className="font-semibold">{totalSessions}</span></div>
                {bounds && (
                  <div className="mt-1.5 border-t border-line pt-1.5 text-[12px] text-dim">
                    Du <span className="font-semibold text-ink">{fmt(bounds.start)}</span> au <span className="font-semibold text-ink">{fmt(bounds.end)}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={inject}
              disabled={!program || totalSessions === 0}
              className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500] disabled:opacity-40"
            >
              Injecter {totalSessions > 0 ? `(${totalSessions} séances)` : ""}
            </button>
            <p className="text-center text-[11px] text-dim">
              Les séances s&apos;ajoutent au plan existant, sans rien supprimer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
