"use client";

import { useState } from "react";

// ─── Mini-calendrier de sélection multiple ─────────────────────────────────────
// Lundi en tête (cohérent avec MonthView de /plan). Clic sur un jour = toggle
// (surbrillance ajoutée/retirée) ; plusieurs jours peuvent être sélectionnés
// pour placer/dupliquer des séances sur chacun d'eux en un seul geste.
// Partagé entre PlaceSessionModal (séance type) et SessionEditor (duplication
// d'une séance sur plusieurs jours depuis son détail).

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const CAL_DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function MiniCalendar({
  selected,
  onToggle,
  initialMonth,
  marked = [],
}: {
  selected: string[];
  onToggle: (date: string) => void;
  initialMonth: string; // "YYYY-MM-DD" — mois initialement affiché
  /** Jours déjà occupés (ex : date actuelle de la séance) — affichés en relief, non cliquables */
  marked?: string[];
}) {
  const initial = new Date(initialMonth + "T00:00:00");
  const [monthCursor, setMonthCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const todayStr = ymd(new Date());
  const selectedSet = new Set(selected);
  const markedSet = new Set(marked);

  const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(<div key={`pad-${i}`} />);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = ymd(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day));
    const isSelected = selectedSet.has(date);
    const isMarked = markedSet.has(date);
    const isToday = date === todayStr;
    cells.push(
      <button
        key={date}
        type="button"
        disabled={isMarked}
        title={isMarked ? "La séance est déjà placée ce jour-là" : undefined}
        onClick={() => onToggle(date)}
        className={`grid h-9 place-items-center rounded-lg text-[13px] font-semibold transition ${
          isMarked
            ? "cursor-default bg-ok/20 text-ok ring-1 ring-ok/50"
            : isSelected
            ? "bg-accent text-[#1a1500]"
            : isToday
            ? "border border-accent text-accent"
            : "text-ink hover:bg-surface2"
        }`}
      >
        {day}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface2 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
          className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-sm"
        >‹</button>
        <span className="text-[13px] font-semibold">
          {MONTHS[monthCursor.getMonth()]} {monthCursor.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
          className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-sm"
        >›</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {CAL_DOW.map((d) => (
          <div key={d} className="py-0.5 text-center text-[10px] font-semibold text-dim">{d}</div>
        ))}
        {cells}
      </div>
    </div>
  );
}
