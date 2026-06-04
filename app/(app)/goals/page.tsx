"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";

const uid = () => Math.random().toString(36).slice(2, 9);

function frenchDate(key: string) {
  if (!key) return "Date ?";
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

export default function GoalsPage() {
  const { state, update, loading } = useData();
  const [competition, setCompetition] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [expected, setExpected] = useState("");

  function add() {
    if (!competition.trim()) return;
    update((d) => {
      d.goals.unshift({ id: uid(), competition: competition.trim(), date, place, expected });
    });
    setCompetition(""); setDate(""); setPlace(""); setExpected("");
  }

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
      {state.goals.length === 0 ? (
        <p className="py-8 text-center text-dim">Aucun objectif pour l&apos;instant.</p>
      ) : (
        <div className="space-y-2.5">
          {state.goals.map((g) => (
            <div key={g.id} className="rounded-xl border border-line bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <strong>{g.competition}</strong>
                <button
                  onClick={() => update((d) => { d.goals = d.goals.filter((x) => x.id !== g.id); })}
                  className="rounded-lg bg-danger px-3 py-1.5 text-[13px] font-semibold text-white"
                >
                  Suppr.
                </button>
              </div>
              <div className="text-xs text-dim">
                {frenchDate(g.date)} · {g.place || "Lieu ?"}
              </div>
              {g.expected && <p className="mt-2 whitespace-pre-wrap text-sm">{g.expected}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
