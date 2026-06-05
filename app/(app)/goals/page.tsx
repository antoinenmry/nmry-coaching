"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { countdownLabel, daysUntil, frenchDate } from "@/lib/dates";
import type { Goal } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 9);

// Tri : à venir (du plus proche), puis passés (du plus récent), puis sans date.
function sortRank(g: Goal): [number, number] {
  const n = g.date ? daysUntil(g.date) : null;
  if (n === null) return [2, 0];
  if (n >= 0) return [0, n];
  return [1, -n];
}

export default function GoalsPage() {
  const { state, update, loading } = useData();
  const [competition, setCompetition] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [expected, setExpected] = useState("");
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
      d.goals.unshift({ id: uid(), competition: competition.trim(), date, place, expected });
    });
    setCompetition(""); setDate(""); setPlace(""); setExpected("");
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
        <label className="mb-4 block">
          <span className="mb-1.5 block text-[13px] text-dim">Performances attendues</span>
          <textarea value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="Ex : Squat 180kg, Bench 120kg, Deadlift 220kg" />
        </label>
        <button onClick={add} className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500]">
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
                {g.expected && <p className="mt-2 whitespace-pre-wrap text-sm">{g.expected}</p>}
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

function EditGoalModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { update } = useData();
  const [competition, setCompetition] = useState(goal.competition);
  const [date, setDate] = useState(goal.date);
  const [place, setPlace] = useState(goal.place);
  const [expected, setExpected] = useState(goal.expected);

  function save() {
    update((d) => {
      const g = d.goals.find((x) => x.id === goal.id);
      if (g) Object.assign(g, { competition: competition.trim() || g.competition, date, place, expected });
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
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
        <label className="mb-4 block">
          <span className="mb-1.5 block text-[13px] text-dim">Performances attendues</span>
          <textarea value={expected} onChange={(e) => setExpected(e.target.value)} />
        </label>
        <button onClick={save} className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500]">Enregistrer</button>
      </div>
    </div>
  );
}
