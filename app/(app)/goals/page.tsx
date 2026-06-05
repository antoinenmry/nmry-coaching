"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { countdownLabel, daysUntil, frenchDate } from "@/lib/dates";
import type { Goal, GoalEvent } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 9);

function sortRank(g: Goal): [number, number] {
  const n = g.date ? daysUntil(g.date) : null;
  if (n === null) return [2, 0];
  if (n >= 0) return [0, n];
  return [1, -n];
}

// ─── Éditeur d'épreuves réutilisable ──────────────────────────────────────────
function EventsEditor({
  events,
  onChange,
}: {
  events: GoalEvent[];
  onChange: (evts: GoalEvent[]) => void;
}) {
  function addEvent() {
    onChange([...events, { id: uid(), name: "", planned: "", achieved: "" }]);
  }
  function removeEvent(id: string) {
    onChange(events.filter((e) => e.id !== id));
  }
  function patchEvent(id: string, field: keyof GoalEvent, value: string) {
    onChange(events.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  }

  return (
    <div>
      {events.length > 0 && (
        <div className="mb-2 space-y-2">
          {/* En-tête colonnes */}
          <div className="grid grid-cols-[1fr_1fr_1fr_24px] gap-1.5 px-0.5">
            <span className="text-[11px] font-semibold text-dim">Épreuve</span>
            <span className="text-[11px] font-semibold text-dim">Prévu</span>
            <span className="text-[11px] font-semibold text-dim">Réalisé</span>
            <span />
          </div>
          {events.map((e) => (
            <div key={e.id} className="grid grid-cols-[1fr_1fr_1fr_24px] gap-1.5 items-center">
              <input
                value={e.name}
                onChange={(ev) => patchEvent(e.id, "name", ev.target.value)}
                placeholder="Squat…"
                className="!text-[13px] !py-1.5"
              />
              <input
                value={e.planned}
                onChange={(ev) => patchEvent(e.id, "planned", ev.target.value)}
                placeholder="180 kg"
                className="!text-[13px] !py-1.5"
              />
              <input
                value={e.achieved}
                onChange={(ev) => patchEvent(e.id, "achieved", ev.target.value)}
                placeholder="—"
                className="!text-[13px] !py-1.5"
              />
              <button
                onClick={() => removeEvent(e.id)}
                className="grid h-6 w-6 place-items-center rounded-md bg-surface2 text-[12px] text-dim hover:bg-danger/20 hover:text-danger"
                type="button"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={addEvent}
        type="button"
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-[13px] text-dim hover:border-accent hover:text-accent"
      >
        + Ajouter une épreuve
      </button>
    </div>
  );
}

// ─── Affichage des épreuves en lecture ────────────────────────────────────────
export function EventsDisplay({ events }: { events: GoalEvent[] }) {
  if (!events || events.length === 0) return null;
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-3 border-b border-line bg-surface2 px-3 py-1.5">
        <span className="text-[11px] font-semibold text-dim">Épreuve</span>
        <span className="text-[11px] font-semibold text-dim">Prévu</span>
        <span className="text-[11px] font-semibold text-dim">Réalisé</span>
      </div>
      {events.map((e) => (
        <div key={e.id} className="grid grid-cols-3 border-b border-line px-3 py-2 last:border-0">
          <span className="text-[13px] font-medium">{e.name || "—"}</span>
          <span className="text-[13px] text-dim">{e.planned || "—"}</span>
          <span className={`text-[13px] font-semibold ${e.achieved ? "text-ok" : "text-dim"}`}>
            {e.achieved || "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function GoalsPage() {
  const { state, update, loading } = useData();
  const [competition, setCompetition] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [expected, setExpected] = useState("");
  const [events, setEvents] = useState<GoalEvent[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...state.goals].sort((a, b) => {
      const [ga, va] = sortRank(a);
      const [gb, vb] = sortRank(b);
      return ga - gb || va - vb;
    });
  }, [state.goals]);

  function add() {
    if (!competition.trim()) return;
    update((d) => {
      d.goals.unshift({
        id: uid(),
        competition: competition.trim(),
        date,
        place,
        expected,
        events: events.filter((e) => e.name.trim()),
      });
    });
    setCompetition(""); setDate(""); setPlace(""); setExpected(""); setEvents([]);
  }

  const editingGoal = state.goals.find((g) => g.id === editingId) ?? null;

  if (loading) return <p className="py-10 text-center text-dim">Chargement…</p>;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-4 text-xl font-bold">Nouvel objectif</h2>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-[13px] text-dim">Nom de la compétition</span>
          <input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Ex : Championnat régional" />
        </label>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-dim">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-dim">Lieu</span>
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Ville / salle" />
          </label>
        </div>

        {/* Épreuves */}
        <div className="mb-3">
          <span className="mb-1.5 block text-[13px] text-dim">Épreuves</span>
          <EventsEditor events={events} onChange={setEvents} />
        </div>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-[13px] text-dim">Commentaires</span>
          <textarea value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="Notes, contexte, ambitions générales…" />
        </label>
        <button
          onClick={add}
          disabled={!competition.trim()}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500] disabled:opacity-40"
        >
          Ajouter l&apos;objectif
        </button>
      </section>

      <h2 className="text-xl font-bold">Mes objectifs</h2>
      {sorted.length === 0 ? (
        <p className="py-8 text-center text-dim">Aucun objectif pour l&apos;instant.</p>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((g) => {
            const n = daysUntil(g.date);
            const future = n !== null && n >= 0;
            return (
              <div key={g.id} className="rounded-xl border border-line bg-surface p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <strong>{g.competition}</strong>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold ${future ? "bg-ok/20 text-ok" : "bg-surface2 text-dim"}`}>
                    {countdownLabel(g.date)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-dim">
                  {frenchDate(g.date)}{g.place ? ` · ${g.place}` : ""}
                </div>
                {/* Épreuves */}
                <EventsDisplay events={g.events ?? []} />
                {/* Commentaires */}
                {g.expected && <p className="mt-2 whitespace-pre-wrap text-sm text-dim">{g.expected}</p>}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setEditingId(g.id)} className="rounded-lg bg-surface2 px-3 py-1.5 text-[13px] font-semibold">
                    Modifier
                  </button>
                  <button
                    onClick={() => update((d) => { d.goals = d.goals.filter((x) => x.id !== g.id); })}
                    className="rounded-lg bg-danger px-3 py-1.5 text-[13px] font-semibold text-white"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingGoal && <EditGoalModal goal={editingGoal} onClose={() => setEditingId(null)} />}
    </div>
  );
}

// ─── Modale d'édition ─────────────────────────────────────────────────────────
function EditGoalModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { update } = useData();
  const [competition, setCompetition] = useState(goal.competition);
  const [date, setDate] = useState(goal.date);
  const [place, setPlace] = useState(goal.place);
  const [expected, setExpected] = useState(goal.expected);
  const [events, setEvents] = useState<GoalEvent[]>(goal.events ?? []);

  function save() {
    update((d) => {
      const g = d.goals.find((x) => x.id === goal.id);
      if (g) Object.assign(g, {
        competition: competition.trim() || g.competition,
        date,
        place,
        expected,
        events: events.filter((e) => e.name.trim()),
      });
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Modifier l&apos;objectif</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-surface2">✕</button>
        </div>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-[13px] text-dim">Nom de la compétition</span>
          <input value={competition} onChange={(e) => setCompetition(e.target.value)} />
        </label>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-dim">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-dim">Lieu</span>
            <input value={place} onChange={(e) => setPlace(e.target.value)} />
          </label>
        </div>

        {/* Épreuves */}
        <div className="mb-3">
          <span className="mb-1.5 block text-[13px] text-dim">Épreuves</span>
          <EventsEditor events={events} onChange={setEvents} />
        </div>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-[13px] text-dim">Commentaires</span>
          <textarea value={expected} onChange={(e) => setExpected(e.target.value)} />
        </label>
        <button onClick={save} className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500]">
          Enregistrer
        </button>
      </div>
    </div>
  );
}
