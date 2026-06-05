"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import SessionEditor from "@/components/SessionEditor";
import ExerciseMultiSelect from "@/components/ExerciseMultiSelect";
import { SESSION_COLORS, newSession, exerciseInstanceFromLibrary } from "@/lib/data";
import type { Goal } from "@/lib/types";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DOW = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shortName = (n: string) => n.split("(")[0].trim();
const EMOJIS = ["😫", "😕", "😐", "🙂", "🤩"];
const emojiOf = (n: number) => (n >= 1 && n <= 5 ? EMOJIS[n - 1] + " " : "");

export default function PlanPage() {
  const { state, loading } = useData();
  const [mode, setMode] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [composing, setComposing] = useState<string | null>(null); // dateKey
  const [editing, setEditing] = useState<{ dateKey: string; sessionId: string } | null>(null);

  const todayKey = ymd(new Date());

  // Objectifs (compétitions) indexés par date, pour les mettre en surbrillance.
  const goalsByDate = useMemo(() => {
    const m: Record<string, Goal[]> = {};
    state.goals.forEach((g) => {
      if (g.date) (m[g.date] ??= []).push(g);
    });
    return m;
  }, [state.goals]);

  function shiftPeriod(dir: number) {
    const d = new Date(cursor);
    if (mode === "month") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setCursor(d);
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
        Touche un jour pour créer une séance en piochant dans ta bibliothèque.
      </p>

      {/* Calendrier */}
      {mode === "month" ? (
        <MonthView
          cursor={cursor}
          todayKey={todayKey}
          planning={state.planning}
          goalsByDate={goalsByDate}
          onCompose={setComposing}
          onOpen={(dateKey, sessionId) => setEditing({ dateKey, sessionId })}
        />
      ) : (
        <WeekView
          cursor={cursor}
          todayKey={todayKey}
          planning={state.planning}
          goalsByDate={goalsByDate}
          onCompose={setComposing}
          onOpen={(dateKey, sessionId) => setEditing({ dateKey, sessionId })}
        />
      )}

      {/* Légende */}
      {state.goals.some((g) => g.date) && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-dim">
          <span className="inline-block h-3 w-3 rounded border border-ok bg-ok/20" /> 🎯 Jour de compétition (objectif déclaré)
        </p>
      )}

      {editing && editingSession && (
        <SessionEditor
          dateKey={editing.dateKey}
          session={editingSession}
          onClose={() => setEditing(null)}
        />
      )}

      {composing && (
        <ComposeModal
          dateKey={composing}
          onClose={() => setComposing(null)}
          onCreated={(sessionId) => {
            const dateKey = composing;
            setComposing(null);
            setEditing({ dateKey, sessionId });
          }}
        />
      )}
    </div>
  );
}

// Modale de composition : nom + couleur + sélection multiple d'exercices.
function ComposeModal({
  dateKey,
  onClose,
  onCreated,
}: {
  dateKey: string;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}) {
  const { update } = useData();
  const [name, setName] = useState("Séance");
  const [color, setColor] = useState(SESSION_COLORS[0]);
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function create() {
    let newId = "";
    update((d) => {
      const s = newSession(name.trim() || "Séance", color);
      newId = s.id;
      picked.forEach((id) => {
        const libEx = d.library.exercises.find((e) => e.id === id);
        s.exercises.push(exerciseInstanceFromLibrary({ id, name: libEx?.name ?? "Exercice" }));
      });
      (d.planning[dateKey] ??= []).push(s);
    });
    onCreated(newId);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Nouvelle séance · {frenchDate(dateKey)}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-[13px] text-dim">Nom de la séance</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Haut du corps A" />
        </label>

        <div className="mb-3">
          <span className="mb-1.5 block text-[13px] text-dim">Couleur</span>
          <div className="flex gap-2">
            {SESSION_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-ink" : "border-transparent"}`}
                style={{ background: c }}
                aria-label={`Couleur ${c}`}
              />
            ))}
          </div>
        </div>

        <span className="mb-1.5 block text-[13px] text-dim">Exercices ({picked.length} sélectionné{picked.length > 1 ? "s" : ""})</span>
        <ExerciseMultiSelect picked={picked} onToggle={toggle} />

        <button
          onClick={create}
          className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500]"
        >
          Créer la séance
        </button>
      </div>
    </div>
  );
}

function frenchDate(key: string) {
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${months[m - 1]} ${y}`;
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
  goalsByDate: Record<string, Goal[]>;
  onCompose: (dateKey: string) => void;
  onOpen: (dateKey: string, sessionId: string) => void;
}

function MonthView({ cursor, todayKey, planning, goalsByDate, onCompose, onOpen }: ViewProps) {
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
    const goals = goalsByDate[key] ?? [];
    const isGoal = goals.length > 0;
    cells.push(
      <div
        key={key}
        onClick={() => onCompose(key)}
        className={`flex min-h-[78px] cursor-pointer flex-col gap-1 rounded-lg border p-1 ${
          isGoal
            ? "border-ok bg-ok/10 ring-1 ring-ok/50"
            : `bg-surface ${key === todayKey ? "border-accent" : "border-line"}`
        }`}
      >
        <span className="flex items-center justify-between text-[11px] text-dim">
          {day}
          {isGoal && <span title={goals.map((g) => g.competition).join(", ")}>🎯</span>}
        </span>
        {isGoal && (
          <span
            className="truncate rounded-md bg-ok/25 px-1.5 py-0.5 text-[10px] font-semibold text-ok"
            title={goals.map((g) => g.competition).join(", ")}
          >
            {goals[0].competition}
          </span>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={(e) => { e.stopPropagation(); onOpen(key, s.id); }}
            className="truncate rounded-md px-1.5 py-1 text-left text-[11px] font-semibold text-[#06121f]"
            style={{ background: s.color }}
          >
            {emojiOf(s.emoji)}{shortName(s.name)}
          </button>
        ))}
      </div>,
    );
  }

  return <div className="grid grid-cols-7 gap-1.5">{cells}</div>;
}

function WeekView({ cursor, todayKey, planning, goalsByDate, onCompose, onOpen }: ViewProps) {
  const monday = new Date(cursor);
  monday.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));

  return (
    <div className="space-y-2.5">
      {Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const key = ymd(date);
        const sessions = planning[key] ?? [];
        const goals = goalsByDate[key] ?? [];
        const isGoal = goals.length > 0;
        return (
          <div
            key={key}
            onClick={() => onCompose(key)}
            className={`cursor-pointer rounded-xl border p-3 ${
              isGoal ? "border-ok bg-ok/10" : `bg-surface ${key === todayKey ? "border-accent" : "border-line"}`
            }`}
          >
            <h3 className="mb-2 flex justify-between text-sm font-semibold">
              {DOW[i]}
              <span className="font-normal text-dim">
                {date.getDate()} {MONTHS[date.getMonth()].slice(0, 3)}
              </span>
            </h3>
            {goals.map((g) => (
              <div
                key={g.id}
                className="mb-2 flex items-center gap-1.5 rounded-md bg-ok/20 px-2 py-1 text-[13px] font-semibold text-ok"
              >
                🎯 {g.competition}
                {g.place && <span className="font-normal opacity-80">· {g.place}</span>}
              </div>
            ))}
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
                    {emojiOf(s.emoji)}{s.name}
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
