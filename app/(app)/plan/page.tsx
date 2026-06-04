"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import SessionEditor from "@/components/SessionEditor";
import { SESSION_TEMPLATES, instanceFromTemplate } from "@/lib/data";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DOW = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shortName = (n: string) => n.split("(")[0].trim();

export default function PlanPage() {
  const { state, update, loading } = useData();
  const [mode, setMode] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [pendingTpl, setPendingTpl] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ dateKey: string; sessionId: string } | null>(null);

  const todayKey = ymd(new Date());

  function shiftPeriod(dir: number) {
    const d = new Date(cursor);
    if (mode === "month") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setCursor(d);
  }

  function place(dateKey: string, tplId: string | null) {
    if (!tplId) return;
    update((draft) => {
      (draft.planning[dateKey] ??= []).push(instanceFromTemplate(tplId));
    });
    setPendingTpl(null);
  }

  const editingSession =
    editing && state.planning[editing.dateKey]?.find((s) => s.id === editing.sessionId);

  if (loading) return <p className="py-10 text-center text-dim">Chargement…</p>;

  return (
    <div>
      {/* Barre d'outils */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-surface2 p-1">
          {(["month", "week"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3.5 py-2 text-sm font-semibold ${
                mode === m ? "bg-accent text-[#1a1500]" : "text-dim"
              }`}
            >
              {m === "month" ? "Mois" : "Semaine"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <button onClick={() => shiftPeriod(-1)} className="h-9 w-9 rounded-lg bg-surface2 text-lg">‹</button>
          <span className="min-w-[130px] text-center text-sm font-bold">{periodLabel(mode, cursor)}</span>
          <button onClick={() => shiftPeriod(1)} className="h-9 w-9 rounded-lg bg-surface2 text-lg">›</button>
        </div>
      </div>

      <p className="mb-2.5 text-xs text-dim">
        Glisse une séance sur un jour. Sur mobile : appuie sur une séance puis sur le jour cible.
      </p>

      {/* Bibliothèque */}
      <div className="mb-3.5 flex gap-2.5 overflow-x-auto pb-2">
        {SESSION_TEMPLATES.map((t) => (
          <button
            key={t.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/tpl", t.id)}
            onClick={() => setPendingTpl(pendingTpl === t.id ? null : t.id)}
            className={`flex-none cursor-grab select-none rounded-xl border bg-surface2 px-3.5 py-2.5 text-sm font-semibold ${
              pendingTpl === t.id ? "border-accent" : "border-line"
            }`}
            style={{ borderLeft: `5px solid ${t.color}` }}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Calendrier */}
      {mode === "month" ? (
        <MonthView
          cursor={cursor}
          todayKey={todayKey}
          planning={state.planning}
          pendingTpl={pendingTpl}
          onPlace={place}
          onOpen={(dateKey, sessionId) => setEditing({ dateKey, sessionId })}
        />
      ) : (
        <WeekView
          cursor={cursor}
          todayKey={todayKey}
          planning={state.planning}
          pendingTpl={pendingTpl}
          onPlace={place}
          onOpen={(dateKey, sessionId) => setEditing({ dateKey, sessionId })}
        />
      )}

      {editing && editingSession && (
        <SessionEditor
          dateKey={editing.dateKey}
          session={editingSession}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function periodLabel(mode: "month" | "week", cursor: Date) {
  if (mode === "month") return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const monday = new Date(cursor);
  monday.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.getDate()} ${MONTHS[monday.getMonth()].slice(0, 3)} – ${sunday.getDate()} ${MONTHS[sunday.getMonth()].slice(0, 3)}`;
}

interface ViewProps {
  cursor: Date;
  todayKey: string;
  planning: ReturnType<typeof useData>["state"]["planning"];
  pendingTpl: string | null;
  onPlace: (dateKey: string, tplId: string | null) => void;
  onOpen: (dateKey: string, sessionId: string) => void;
}

function dayHandlers(dateKey: string, pendingTpl: string | null, onPlace: ViewProps["onPlace"]) {
  return {
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      onPlace(dateKey, e.dataTransfer.getData("text/tpl"));
    },
    onClick: () => {
      if (pendingTpl) onPlace(dateKey, pendingTpl);
    },
  };
}

function MonthView({ cursor, todayKey, planning, pendingTpl, onPlace, onOpen }: ViewProps) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();

  const cells: React.ReactNode[] = DOW.map((d) => (
    <div key={`dow-${d}`} className="py-1 text-center text-[11px] font-semibold text-dim">{d}</div>
  ));
  for (let i = 0; i < startOffset; i++) cells.push(<div key={`pad-${i}`} className="opacity-30" />);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    const key = ymd(date);
    const sessions = planning[key] ?? [];
    cells.push(
      <div
        key={key}
        {...dayHandlers(key, pendingTpl, onPlace)}
        className={`flex min-h-[78px] flex-col gap-1 rounded-lg border bg-surface p-1 ${
          key === todayKey ? "border-accent" : "border-line"
        }`}
      >
        <span className="text-[11px] text-dim">{day}</span>
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={(e) => { e.stopPropagation(); onOpen(key, s.id); }}
            className="truncate rounded-md px-1.5 py-1 text-left text-[11px] font-semibold text-[#06121f]"
            style={{ background: s.color }}
          >
            {shortName(s.name)}
          </button>
        ))}
      </div>,
    );
  }

  return <div className="grid grid-cols-7 gap-1.5">{cells}</div>;
}

function WeekView({ cursor, todayKey, planning, pendingTpl, onPlace, onOpen }: ViewProps) {
  const monday = new Date(cursor);
  monday.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));

  return (
    <div className="space-y-2.5">
      {Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const key = ymd(date);
        const sessions = planning[key] ?? [];
        return (
          <div
            key={key}
            {...dayHandlers(key, pendingTpl, onPlace)}
            className={`rounded-xl border bg-surface p-3 ${key === todayKey ? "border-accent" : "border-line"}`}
          >
            <h3 className="mb-2 flex justify-between text-sm font-semibold">
              {DOW[i]}
              <span className="font-normal text-dim">
                {date.getDate()} {MONTHS[date.getMonth()].slice(0, 3)}
              </span>
            </h3>
            <div className="flex flex-col gap-1.5">
              {sessions.length === 0 ? (
                <span className="text-[13px] italic text-dim">Repos / rien de prévu</span>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={(e) => { e.stopPropagation(); onOpen(key, s.id); }}
                    className="rounded-md px-2 py-1.5 text-left text-[13px] font-semibold text-[#06121f]"
                    style={{ background: s.color }}
                  >
                    {s.name}
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
