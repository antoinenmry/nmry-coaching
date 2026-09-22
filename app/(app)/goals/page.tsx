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

// ─── Styles partagés (même esthétique que /plan et /followup) ────────────────
const MONTHS_SHORT = ["JAN", "FÉV", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"];
const LABEL = "mb-1.5 block text-[10.5px] font-black uppercase tracking-[0.12em] text-dim";
const GOLD = "bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500]";
const CARD =
  "rounded-[20px] border border-line bg-[radial-gradient(120%_80%_at_0%_0%,rgba(102,187,106,0.10),transparent_60%),var(--color-surface)]";

function DateTile({ date, future }: { date: string; future: boolean }) {
  const [, m, d] = date ? date.split("-").map(Number) : [0, 0, 0];
  return (
    <div
      className={`grid h-14 w-14 shrink-0 place-content-center rounded-2xl border-2 text-center leading-none ${
        future
          ? "border-ok/70 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--color-ok)_22%,transparent),transparent)] text-ok"
          : "border-line text-dim"
      }`}
    >
      {date ? (
        <>
          <span className="text-[22px] font-black">{d}</span>
          <span className="mt-0.5 text-[9.5px] font-black tracking-[0.1em] opacity-80">{MONTHS_SHORT[m - 1]}</span>
        </>
      ) : (
        <span className="text-lg font-black">?</span>
      )}
    </div>
  );
}

// Ligne compacte : date, nom, lieu / épreuves, objectif principal + décompte.
function GoalRow({ g, isNext, onOpen }: { g: Goal; isNext: boolean; onOpen: () => void }) {
  const n = daysUntil(g.date);
  const future = n !== null && n >= 0;
  const events = (g.events ?? []).filter((e) => e.name.trim());
  const main = events.find((e) => e.planned.trim());
  const sub = [g.place, events.length > 0 ? `${events.length} épreuve${events.length > 1 ? "s" : ""}` : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition active:bg-surface2/60">
      <DateTile date={g.date} future={future} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15px] font-black ${future ? "text-ink" : "text-dim"}`}>{g.competition}</p>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          {isNext && (
            <span className="shrink-0 rounded-md border border-ok/60 px-1.5 py-px text-[10px] font-black tracking-[0.08em] text-ok">
              PROCHAIN
            </span>
          )}
          {sub && <span className="truncate text-[12.5px] text-dim">{sub}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right leading-tight">
        {main ? (
          <>
            <p className={`max-w-[92px] truncate text-[17px] font-black ${future ? "text-ok" : "text-dim"}`}>{main.achieved || main.planned}</p>
            <p className="text-[11.5px] font-bold text-dim">{countdownLabel(g.date).replace("-", "–")}</p>
          </>
        ) : (
          <p className={`text-[15px] font-black ${future ? "text-ok" : "text-dim"}`}>{countdownLabel(g.date).replace("-", "–")}</p>
        )}
      </div>
      <span aria-hidden className="text-lg text-dim">›</span>
    </button>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function GoalsPage() {
  const { state, loading } = useData();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...state.goals].sort((a, b) => {
      const [ga, va] = sortRank(a);
      const [gb, vb] = sortRank(b);
      return ga - gb || va - vb;
    });
  }, [state.goals]);

  const upcoming = sorted.filter((g) => sortRank(g)[0] === 0);
  const others = sorted.filter((g) => sortRank(g)[0] !== 0);
  const openGoal = state.goals.find((g) => g.id === openId) ?? null;
  const editingGoal = state.goals.find((g) => g.id === editingId) ?? null;

  if (loading) return <p className="py-10 text-center text-dim">Chargement…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-xl font-black">Mes objectifs</h2>
        <button
          onClick={() => setCreating(true)}
          aria-label="Nouvel objectif"
          className={`grid h-11 w-11 place-items-center rounded-full text-2xl font-black leading-none shadow-[0_6px_18px_-6px_rgba(255,170,0,0.7)] transition active:scale-95 ${GOLD}`}
        >
          +
        </button>
      </div>

      {sorted.length === 0 ? (
        <button
          onClick={() => setCreating(true)}
          className="flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-line p-4 text-left text-[13px] leading-snug text-dim"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface2 text-lg font-black text-accent">+</span>
          Aucun objectif. Ajoute ta prochaine compétition.
        </button>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className={CARD}>
              <h3 className="px-4 pt-3.5 text-[11px] font-black uppercase tracking-[0.12em] text-ok">À venir</h3>
              <div className="divide-y divide-line/60 pb-1">
                {upcoming.map((g, i) => (
                  <GoalRow key={g.id} g={g} isNext={i === 0} onOpen={() => setOpenId(g.id)} />
                ))}
              </div>
            </section>
          )}
          {others.length > 0 && (
            <section className="rounded-[20px] border border-line bg-surface">
              <h3 className="px-4 pt-3.5 text-[11px] font-black uppercase tracking-[0.12em] text-dim">
                {others.every((g) => sortRank(g)[0] === 1) ? "Passés" : "Passés et sans date"}
              </h3>
              <div className="divide-y divide-line/60 pb-1">
                {others.map((g) => (
                  <GoalRow key={g.id} g={g} isNext={false} onOpen={() => setOpenId(g.id)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {openGoal && (
        <GoalDetailModal
          goal={openGoal}
          onClose={() => setOpenId(null)}
          onEdit={() => { setOpenId(null); setEditingId(openGoal.id); }}
        />
      )}
      {creating && <GoalFormModal onClose={() => setCreating(false)} />}
      {editingGoal && <GoalFormModal goal={editingGoal} onClose={() => setEditingId(null)} />}
    </div>
  );
}

// ─── Fiche détail (au tap) ────────────────────────────────────────────────────
function GoalDetailModal({ goal, onClose, onEdit }: { goal: Goal; onClose: () => void; onEdit: () => void }) {
  const { update } = useData();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const n = daysUntil(goal.date);
  const future = n !== null && n >= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-line bg-surface sm:rounded-3xl sm:border">
        {/* En-tête en dégradé */}
        <div
          className={`relative p-5 ${
            future
              ? "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-ok)_30%,var(--color-surface)),var(--color-surface)_75%)]"
              : "bg-surface2"
          }`}
        >
          <button onClick={onClose} aria-label="Fermer" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-black/25">✕</button>
          <div className="flex items-center gap-3 pr-10">
            <DateTile date={goal.date} future={future} />
            <div className="min-w-0">
              <h2 className="text-lg font-black leading-tight">{goal.competition}</h2>
              <p className="mt-0.5 text-[12.5px] text-dim">
                {frenchDate(goal.date)}{goal.place ? ` · ${goal.place}` : ""}
              </p>
            </div>
          </div>
          <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[12px] font-black ${future ? "bg-ok text-[#0d2410]" : "bg-surface text-dim"}`}>
            {countdownLabel(goal.date)}
          </span>
        </div>

        <div className="space-y-4 p-5 pt-4">
          {(goal.events ?? []).length > 0 && (
            <div>
              <span className={LABEL}>Épreuves</span>
              <EventsDisplay events={goal.events ?? []} />
            </div>
          )}
          {goal.expected && (
            <div>
              <span className={LABEL}>Commentaires</span>
              <p className="whitespace-pre-wrap text-sm text-ink">{goal.expected}</p>
            </div>
          )}
          <button onClick={onEdit} className={`w-full rounded-full py-3 font-black transition active:scale-[0.98] ${GOLD}`}>
            Modifier
          </button>
          <button
            onClick={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              update((d) => { d.goals = d.goals.filter((x) => x.id !== goal.id); });
              onClose();
            }}
            className={`-mt-2 w-full rounded-full border py-2.5 text-[13px] font-black transition ${
              confirmDelete ? "border-danger bg-danger text-white" : "border-danger/40 text-danger"
            }`}
          >
            {confirmDelete ? "Confirmer la suppression" : "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pop-up création / édition ────────────────────────────────────────────────
function GoalFormModal({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { update, state, library } = useData();
  const [competition, setCompetition] = useState(goal?.competition ?? "");
  const [date, setDate] = useState(goal?.date ?? "");
  const [place, setPlace] = useState(goal?.place ?? "");
  const [expected, setExpected] = useState(goal?.expected ?? "");
  const [events, setEvents] = useState<GoalEvent[]>(goal?.events ?? []);

  function save() {
    if (!competition.trim()) return;
    const cleanEvents = events.filter((e) => e.name.trim());
    update((d) => {
      if (!goal) {
        d.goals.unshift({ id: uid(), competition: competition.trim(), date, place, expected, events: cleanEvents });
        return;
      }
      const g = d.goals.find((x) => x.id === goal.id);
      if (g) Object.assign(g, { competition: competition.trim(), date, place, expected, events: cleanEvents });
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">{goal ? "Modifier l'objectif" : "Nouvel objectif"}</h2>
          <button onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full bg-surface2">✕</button>
        </div>
        <label className="mb-3 block">
          <span className={LABEL}>Nom de la compétition</span>
          <input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Ex : Championnat régional" autoFocus={!goal} />
        </label>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className={LABEL}>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className={LABEL}>Lieu</span>
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Ville / salle" />
          </label>
        </div>

        <div className="mb-3">
          <span className={LABEL}>Épreuves</span>
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
          <span className={LABEL}>Commentaires</span>
          <textarea value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="Notes, contexte, ambitions générales…" />
        </label>
        <button
          onClick={save}
          disabled={!competition.trim()}
          className={`w-full rounded-full py-3 font-black transition active:scale-[0.98] disabled:opacity-40 ${GOLD}`}
        >
          {goal ? "Enregistrer" : "Ajouter l'objectif"}
        </button>
      </div>
    </div>
  );
}
