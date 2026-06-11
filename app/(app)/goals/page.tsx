"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { countdownLabel, daysUntil, frenchDate } from "@/lib/dates";
import type { Goal, GoalEvent, LibraryExercise, RecordsData } from "@/lib/types";
import EventsDisplay from "@/components/EventsDisplay";
import { parseWeight, findMatchingExercise, getMaxRecord, saveStrengthRecord } from "@/lib/prDetection";

const uid = () => Math.random().toString(36).slice(2, 9);

function sortRank(g: Goal): [number, number] {
  const n = g.date ? daysUntil(g.date) : null;
  if (n === null) return [2, 0];
  if (n >= 0) return [0, n];
  return [1, -n];
}

// ─── PR helpers ───────────────────────────────────────────────────────────────
type PrProps = {
  exercises: LibraryExercise[];
  records: RecordsData;
  onSaveRecord: (exId: string, exName: string, weight: number) => void;
};

function EventRow({
  event,
  onPatch,
  onRemove,
  prProps,
}: {
  event: GoalEvent;
  onPatch: (patch: Partial<GoalEvent>) => void;
  onRemove: () => void;
  prProps?: PrProps;
}) {
  const [savedWeight, setSavedWeight] = useState<number | null>(null);

  const parsedWeight = prProps ? parseWeight(event.achieved) : null;
  const matchedEx = parsedWeight && prProps ? findMatchingExercise(event.name, prProps.exercises) : null;
  const recordMax = matchedEx && prProps ? getMaxRecord(matchedEx.id, prProps.records) : undefined;

  const isPr =
    parsedWeight !== null &&
    matchedEx !== null &&
    (recordMax === undefined || parsedWeight > recordMax);
  // Décision (enregistrer / ignorer) PERSISTÉE sur l'épreuve (prDismissedWeight)
  // → la bannière ne réapparaît plus à la réouverture de l'objectif.
  const showBanner = isPr && parsedWeight !== event.prDismissedWeight;
  const showSaved = savedWeight !== null && parsedWeight === savedWeight && !isPr;

  return (
    <div>
      <div className="grid grid-cols-[1fr_1fr_1fr_24px] gap-1.5 items-center">
        <input
          value={event.name}
          onChange={(ev) => onPatch({ name: ev.target.value })}
          placeholder="Squat…"
          className="!text-[13px] !py-1.5"
        />
        <input
          value={event.planned}
          onChange={(ev) => onPatch({ planned: ev.target.value })}
          placeholder="180 kg"
          className="!text-[13px] !py-1.5"
        />
        <input
          value={event.achieved}
          onChange={(ev) => onPatch({ achieved: ev.target.value })}
          placeholder="—"
          className={`!text-[13px] !py-1.5 ${showBanner ? "!border-accent/60" : ""}`}
        />
        <button
          onClick={onRemove}
          className="grid h-6 w-6 place-items-center rounded-md bg-surface2 text-[12px] text-dim hover:bg-danger/20 hover:text-danger"
          type="button"
        >
          ✕
        </button>
      </div>

      {showBanner && matchedEx && parsedWeight !== null && (
        <div className="mt-1.5 rounded-xl border border-accent/40 bg-accent/10 p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-bold text-accent">
                {recordMax === undefined ? "Premier record" : "Nouveau record"} — {matchedEx.name}
              </span>
              {recordMax !== undefined && (
                <span className="ml-2 text-[12px] text-dim">
                  {recordMax} kg → {parsedWeight} kg · +{Math.round((parsedWeight - recordMax) * 10) / 10} kg
                </span>
              )}
              {recordMax === undefined && (
                <span className="ml-2 text-[12px] text-dim">{parsedWeight} kg · premier enregistrement</span>
              )}
            </div>
          </div>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (prProps && matchedEx && parsedWeight !== null) {
                  prProps.onSaveRecord(matchedEx.id, matchedEx.name, parsedWeight);
                  setSavedWeight(parsedWeight);
                  onPatch({ prDismissedWeight: parsedWeight });
                }
              }}
              className="rounded-lg bg-accent px-3 py-1 text-[12px] font-semibold text-[#1a1500]"
            >
              ✓ Enregistrer le record
            </button>
            <button
              type="button"
              onClick={() => { if (parsedWeight !== null) onPatch({ prDismissedWeight: parsedWeight }); }}
              className="rounded-lg bg-surface2 px-3 py-1 text-[12px] text-dim"
            >
              Ignorer
            </button>
          </div>
        </div>
      )}

      {showSaved && (
        <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-ok/15 px-2.5 py-1.5 text-[12px] font-semibold text-ok">
          <span>✅</span>
          <span>Record enregistré — {savedWeight} kg{matchedEx ? ` (${matchedEx.name})` : ""}</span>
        </div>
      )}
    </div>
  );
}

// ─── Éditeur d'épreuves réutilisable ──────────────────────────────────────────
function EventsEditor({
  events,
  onChange,
  prProps,
}: {
  events: GoalEvent[];
  onChange: (evts: GoalEvent[]) => void;
  prProps?: PrProps;
}) {
  function addEvent() {
    onChange([...events, { id: uid(), name: "", planned: "", achieved: "" }]);
  }
  function removeEvent(id: string) {
    onChange(events.filter((e) => e.id !== id));
  }
  function patchEvent(id: string, patch: Partial<GoalEvent>) {
    onChange(events.map((e) => (e.id === id ? { ...e, ...patch } : e)));
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
            <EventRow
              key={e.id}
              event={e}
              onPatch={(patch) => patchEvent(e.id, patch)}
              onRemove={() => removeEvent(e.id)}
              prProps={prProps}
            />
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

// ─── Page principale ──────────────────────────────────────────────────────────
export default function GoalsPage() {
  const { state, update, loading, library } = useData();
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
          <EventsEditor
            events={events}
            onChange={setEvents}
            prProps={{
              exercises: library.exercises,
              records: state.records,
              onSaveRecord: (exId, exName, weight) =>
                update((d) => saveStrengthRecord(d.records, exId, exName, weight, 1)),
            }}
          />
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
  const { update, state, library } = useData();
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
          <EventsEditor
            events={events}
            onChange={setEvents}
            prProps={{
              exercises: library.exercises,
              records: state.records,
              onSaveRecord: (exId, exName, weight) =>
                update((d) => saveStrengthRecord(d.records, exId, exName, weight, 1)),
            }}
          />
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
