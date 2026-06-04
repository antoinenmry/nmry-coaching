"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import type { Followup } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 9);
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function frenchDate(key: string) {
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

export default function FollowupPage() {
  const { state, update, loading } = useData();
  const [type, setType] = useState<Followup["type"]>("note");
  const [text, setText] = useState("");

  function add() {
    if (!text.trim()) return;
    update((d) => {
      d.followups.unshift({ id: uid(), date: todayKey(), type, text: text.trim() });
    });
    setText("");
  }

  if (loading) return <p className="py-10 text-center text-dim">Chargement…</p>;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-4 text-xl font-bold">Nouvelle entrée</h2>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-[13px] text-dim">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as Followup["type"])}>
            <option value="note">Commentaire / ressenti</option>
            <option value="injury">Blessure</option>
          </select>
        </label>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-[13px] text-dim">Détails</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Décris ton ressenti, une douleur, une blessure..." />
        </label>
        <button onClick={add} className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500]">
          Ajouter
        </button>
      </section>

      <h2 className="text-xl font-bold">Historique</h2>
      {state.followups.length === 0 ? (
        <p className="py-8 text-center text-dim">Aucune entrée pour l&apos;instant.</p>
      ) : (
        <div className="space-y-2.5">
          {state.followups.map((f) => (
            <div key={f.id} className="rounded-xl border border-line bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    f.type === "injury" ? "bg-danger/20 text-[#ef9a9a]" : "bg-accent2/20 text-[#90caf9]"
                  }`}
                >
                  {f.type === "injury" ? "Blessure" : "Note"}
                </span>
                <button
                  onClick={() => update((d) => { d.followups = d.followups.filter((x) => x.id !== f.id); })}
                  className="rounded-lg bg-danger px-3 py-1.5 text-[13px] font-semibold text-white"
                >
                  Suppr.
                </button>
              </div>
              <div className="mt-1.5 text-xs text-dim">{frenchDate(f.date)}</div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{f.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
