"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import type { Followup } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 9);
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
function frenchDate(key: string) {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
function isInjuryActive(f: Followup): boolean {
  const today = todayKey();
  if (f.type !== "injury") return false;
  if (f.date > today) return false;
  if (!f.dateEnd) return true; // pas de fin déclarée = toujours active
  return f.dateEnd >= today;
}

export default function FollowupPage() {
  const { state, update, loading } = useData();
  const [type, setType] = useState<Followup["type"]>("note");
  const [text, setText] = useState("");
  const [dateStart, setDateStart] = useState(todayKey());
  const [dateEnd, setDateEnd] = useState("");

  function add() {
    if (!text.trim()) return;
    const entry: Followup = {
      id: uid(),
      date: type === "injury" ? dateStart : todayKey(),
      ...(type === "injury" && dateEnd ? { dateEnd } : {}),
      type,
      text: text.trim(),
    };
    update((d) => { d.followups.unshift(entry); });
    setText("");
    setDateStart(todayKey());
    setDateEnd("");
  }

  if (loading) return <p className="py-10 text-center text-dim">Chargement…</p>;

  const injuries = state.followups.filter((f) => f.type === "injury");
  const notes = state.followups.filter((f) => f.type === "note");

  return (
    <div className="space-y-4">

      {/* Diète */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-xl font-bold">Diète à suivre</h2>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-dim">Plan alimentaire (modifiable coach ou sportif)</span>
          <textarea
            value={state.profile.diet}
            onChange={(e) => update((d) => { d.profile.diet = e.target.value; })}
            placeholder="Petit-déj, déjeuner, collation, dîner, macros..."
            className="min-h-[80px]"
          />
        </label>
      </section>

      {/* Nouvelle entrée */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-4 text-xl font-bold">Nouvelle entrée</h2>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-[13px] text-dim">Type</span>
          <select value={type} onChange={(e) => { setType(e.target.value as Followup["type"]); setDateEnd(""); }}>
            <option value="note">Commentaire / ressenti</option>
            <option value="injury">Blessure</option>
          </select>
        </label>

        {type === "injury" && (
          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[13px] text-dim">Date de début</span>
              <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] text-dim">Date de fin <span className="text-dim opacity-60">(optionnel)</span></span>
              <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} min={dateStart} />
            </label>
          </div>
        )}

        <label className="mb-4 block">
          <span className="mb-1.5 block text-[13px] text-dim">Détails</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={type === "injury" ? "Zone touchée, intensité, contexte…" : "Décris ton ressenti, une observation…"} />
        </label>
        <button onClick={add} disabled={!text.trim()} className="w-full rounded-xl bg-accent py-3 font-semibold text-[#1a1500] disabled:opacity-40">
          Ajouter
        </button>
      </section>

      {/* Blessures */}
      {injuries.length > 0 && (
        <>
          <h2 className="text-xl font-bold">Blessures</h2>
          <div className="space-y-2.5">
            {injuries.map((f) => {
              const active = isInjuryActive(f);
              return (
                <div key={f.id} className={`rounded-xl border p-3.5 ${active ? "border-danger/50 bg-danger/5" : "border-line bg-surface"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-danger/20 px-2 py-0.5 text-[11px] font-bold text-danger">
                        🩹 Blessure
                      </span>
                      {active && (
                        <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">Active</span>
                      )}
                    </div>
                    <button
                      onClick={() => update((d) => { d.followups = d.followups.filter((x) => x.id !== f.id); })}
                      className="rounded-lg bg-surface2 px-2.5 py-1 text-[12px] text-dim"
                    >
                      Suppr.
                    </button>
                  </div>
                  <div className="mt-1.5 text-[12px] text-dim">
                    {f.dateEnd
                      ? `Du ${frenchDate(f.date)} au ${frenchDate(f.dateEnd)}`
                      : `Depuis le ${frenchDate(f.date)}`}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{f.text}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Notes */}
      {notes.length > 0 && (
        <>
          <h2 className="text-xl font-bold">Notes & ressentis</h2>
          <div className="space-y-2.5">
            {notes.map((f) => (
              <div key={f.id} className="rounded-xl border border-line bg-surface p-3.5">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-accent2/20 px-2 py-0.5 text-[11px] font-bold text-accent2">Note</span>
                  <button
                    onClick={() => update((d) => { d.followups = d.followups.filter((x) => x.id !== f.id); })}
                    className="rounded-lg bg-surface2 px-2.5 py-1 text-[12px] text-dim"
                  >
                    Suppr.
                  </button>
                </div>
                <div className="mt-1.5 text-[12px] text-dim">{frenchDate(f.date)}</div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{f.text}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {state.followups.length === 0 && (
        <p className="py-8 text-center text-dim">Aucune entrée pour l&apos;instant.</p>
      )}
    </div>
  );
}
