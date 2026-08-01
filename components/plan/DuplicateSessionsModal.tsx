"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import MiniCalendar from "./MiniCalendar";
import type { SessionInstance } from "@/lib/types";

const uid = () => crypto.randomUUID();
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DOW = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS = ["jan.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/**
 * Duplique une ou plusieurs séances déjà placées vers un ou plusieurs jours.
 * Étape 1 : cocher les séances à dupliquer. Étape 2 : choisir le(s) jour(s) de
 * destination sur un mini-calendrier. Chaque séance cochée est copiée sur chaque
 * jour sélectionné (nouvelle instance, suivi sportif réinitialisé, "non validée").
 * S'inspire de DuplicateWeekModal, mais à la granularité de la séance.
 */
export default function DuplicateSessionsModal({
  cursor,
  sessionsByDate,
  onClose,
}: {
  cursor: Date;
  sessionsByDate: Record<string, SessionInstance[]>;
  onClose: () => void;
}) {
  const { update } = useData();

  // Toutes les séances placées, triées par date puis par nom.
  const placedSessions = useMemo(() => {
    return Object.entries(sessionsByDate)
      .flatMap(([date, list]) => list.map((s) => ({ ...s, date })))
      .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  }, [sessionsByDate]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  function toggleSession(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleDate(d: string) {
    setSelectedDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  const totalCopies = selectedIds.length * selectedDates.length;

  function duplicate() {
    if (totalCopies === 0) return;
    const sources = placedSessions.filter((s) => selectedIds.includes(s.id));
    update((d) => {
      selectedDates.forEach((date) => {
        sources.forEach((session) => {
          const copy: SessionInstance = {
            ...structuredClone(session),
            id: uid(),
            date,
            done: false,
            emoji: 0,
            // Prescription conservée (nom, couleur, commentaire coach, exercices)
            // mais suivi sportif remis à zéro sur chaque exercice.
            exercises: session.exercises.map((ex) => ({
              ...structuredClone(ex),
              uid: uid(),
              rpeClient: 0,
              clientComment: "",
              weightClient: undefined,
              failed: undefined,
              setLogs: undefined,
              prDismissedWeight: undefined,
            })),
          };
          d.sessions.push(copy);
        });
      });
    });
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
          <h2 className="text-lg font-bold">Dupliquer des séances</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>

        {done ? (
          <div className="space-y-4 p-5 pt-2 text-center">
            <div className="text-5xl">✅</div>
            <div>
              <p className="font-bold">
                {totalCopies > 1 ? `${totalCopies} copies créées !` : "Copie créée !"}
              </p>
              <p className="mt-1 text-[13px] text-dim">
                {selectedIds.length} séance{selectedIds.length > 1 ? "s" : ""} · {selectedDates.map(fmtDate).join(", ")}
              </p>
            </div>
            <button onClick={onClose} className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500]">
              Voir le plan
            </button>
          </div>
        ) : placedSessions.length === 0 ? (
          <div className="p-5 pt-2 text-center">
            <p className="text-dim">Aucune séance placée à dupliquer.</p>
            <p className="mt-1 text-[13px] text-dim">Place d&apos;abord des séances sur le calendrier.</p>
          </div>
        ) : (
          <>
            {/* Zone scrollable : sélection des séances */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5">
              <p className="mb-2 text-[13px] text-dim">
                1. Séance(s) à dupliquer{selectedIds.length > 0 ? ` · ${selectedIds.length} sélectionnée${selectedIds.length > 1 ? "s" : ""}` : ""}
              </p>
              <div className="space-y-1.5 pb-2">
                {placedSessions.map((s) => {
                  const active = selectedIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSession(s.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        active ? "border-accent/60 bg-accent/8" : "border-line bg-surface2 hover:border-accent/30"
                      }`}
                    >
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] font-bold ${
                          active ? "border-accent bg-accent text-[#1a1500]" : "border-line text-transparent"
                        }`}
                      >✓</span>
                      <div className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{s.name}</p>
                        <p className="text-[12px] text-dim">
                          {fmtDate(s.date)} · {s.exercises.length} exercice{s.exercises.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer fixe : destination + confirmation */}
            <div className="shrink-0 space-y-3 border-t border-line p-5 pt-4">
              <p className="text-[13px] text-dim">
                2. Placer sur{selectedDates.length > 0 ? ` · ${selectedDates.length} jour${selectedDates.length > 1 ? "s" : ""}` : ""}
                {selectedDates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDates([])}
                    className="ml-2 text-[12px] text-dim underline"
                  >Effacer</button>
                )}
              </p>
              <MiniCalendar selected={selectedDates} onToggle={toggleDate} initialMonth={ymd(cursor)} />
              <button
                onClick={duplicate}
                disabled={totalCopies === 0}
                className="w-full rounded-xl py-3 font-semibold text-white disabled:opacity-40"
                style={{ background: "#a855f7" }}
              >
                {totalCopies === 0
                  ? "Sélectionne séance(s) et jour(s)"
                  : `Dupliquer (${totalCopies} copie${totalCopies > 1 ? "s" : ""})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
