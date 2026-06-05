"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { emptyRecords } from "@/lib/types";
import type {
  RecordsData,
  StrengthRecord,
  CardioRecord,
  CapDistance,
  HyroxCategory,
  ExerciseLibrary,
} from "@/lib/types";

const CAP_DISTANCES: CapDistance[] = ["1km", "5km", "10km", "21km", "42km"];
const HYROX_CATS: { id: HyroxCategory; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "pro", label: "Pro" },
];
const MAX = 3;

const uid = () => Math.random().toString(36).slice(2, 9);
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m${String(sec).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function shortDate(key: string): string {
  const months = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${months[m - 1]}`;
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function RecordsPage() {
  const { state, update } = useData();
  const [tab, setTab] = useState<"records" | "tendances">("records");

  const records: RecordsData = state.records ?? emptyRecords();

  const patch = (fn: (r: RecordsData) => void) =>
    update((d) => {
      d.records ??= emptyRecords();
      fn(d.records);
    });

  return (
    <div>
      <div className="mb-4">
        <select
          value={tab}
          onChange={(e) => setTab(e.target.value as typeof tab)}
          className="w-full"
        >
          <option value="records">Records</option>
          <option value="tendances">Tendances</option>
        </select>
      </div>

      {tab === "records" ? (
        <RecordsTab records={records} patch={patch} library={state.library} />
      ) : (
        <TendancesTab records={records} library={state.library} />
      )}
    </div>
  );
}

// ─── Onglet Records ───────────────────────────────────────────────────────────

function RecordsTab({
  records,
  patch,
  library,
}: {
  records: RecordsData;
  patch: (fn: (r: RecordsData) => void) => void;
  library: ExerciseLibrary;
}) {
  return (
    <div className="space-y-6">
      <StrengthSection records={records} patch={patch} library={library} />
      <CapSection records={records} patch={patch} />
      <HyroxSection records={records} patch={patch} />
    </div>
  );
}

// ─── Musculation ──────────────────────────────────────────────────────────────

function StrengthSection({
  records,
  patch,
  library,
}: {
  records: RecordsData;
  patch: (fn: (r: RecordsData) => void) => void;
  library: ExerciseLibrary;
}) {
  const [adding, setAdding] = useState<string | null>(null);

  const getExRec = (exId: string) => records.strength.find((r) => r.exId === exId);
  const isVisible = (exId: string) => getExRec(exId)?.visible ?? true;

  const toggleVisible = (exId: string) =>
    patch((r) => {
      const ex = r.strength.find((x) => x.exId === exId);
      if (ex) ex.visible = !ex.visible;
      else r.strength.push({ exId, visible: false, entries: [] });
    });

  const addEntry = (exId: string, entry: Omit<StrengthRecord, "id">) =>
    patch((r) => {
      let ex = r.strength.find((x) => x.exId === exId);
      if (!ex) { ex = { exId, visible: true, entries: [] }; r.strength.push(ex); }
      if (ex.entries.length < MAX) ex.entries.push({ ...entry, id: uid() });
    });

  const removeEntry = (exId: string, entryId: string) =>
    patch((r) => {
      const ex = r.strength.find((x) => x.exId === exId);
      if (ex) ex.entries = ex.entries.filter((e) => e.id !== entryId);
    });

  if (library.exercises.length === 0) {
    return (
      <section>
        <SectionTitle>Musculation</SectionTitle>
        <p className="py-4 text-center text-[13px] text-dim">
          Ajoutez des exercices à la bibliothèque pour créer des records.
        </p>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle>Musculation</SectionTitle>
      <div className="space-y-2">
        {library.exercises.map((ex) => {
          const rec = getExRec(ex.id);
          const visible = isVisible(ex.id);
          const entries = rec?.entries ?? [];
          return (
            <div key={ex.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{ex.name}</span>
                <button
                  onClick={() => { toggleVisible(ex.id); if (adding === ex.id) setAdding(null); }}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-medium transition ${
                    visible ? "bg-accent/15 text-accent" : "bg-surface2 text-dim"
                  }`}
                >
                  {visible ? "Affiché" : "Masqué"}
                </button>
              </div>

              {visible && (
                <>
                  {entries.length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {[...entries]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center justify-between rounded-lg bg-surface2 px-2.5 py-2 text-sm"
                          >
                            <span className="text-dim">{shortDate(e.date)}</span>
                            <span className="font-bold">
                              {e.weight} kg × {e.reps} rép.
                            </span>
                            <button
                              onClick={() => removeEntry(ex.id, e.id)}
                              className="text-dim"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                  {entries.length < MAX && adding !== ex.id && (
                    <button
                      onClick={() => setAdding(ex.id)}
                      className="mt-2 w-full rounded-lg border border-dashed border-line py-1.5 text-[13px] text-dim"
                    >
                      + Ajouter un record
                    </button>
                  )}
                  {adding === ex.id && (
                    <AddStrengthForm
                      onAdd={(e) => { addEntry(ex.id, e); setAdding(null); }}
                      onCancel={() => setAdding(null)}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AddStrengthForm({
  onAdd,
  onCancel,
}: {
  onAdd: (e: Omit<StrengthRecord, "id">) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(todayKey());
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("1");

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-surface2 p-3">
      <label className="block">
        <span className="mb-1 block text-[12px] text-dim">Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[12px] text-dim">Poids (kg)</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="0"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-dim">Répétitions</span>
          <input
            type="number"
            min={1}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() =>
            onAdd({ date, weight: parseFloat(weight) || 0, reps: parseInt(reps) || 1 })
          }
          disabled={!weight || parseFloat(weight) <= 0}
          className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-[#1a1500] disabled:opacity-40"
        >
          Valider
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg bg-surface px-3 py-2 text-sm text-dim"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── CAP ─────────────────────────────────────────────────────────────────────

function CapSection({
  records,
  patch,
}: {
  records: RecordsData;
  patch: (fn: (r: RecordsData) => void) => void;
}) {
  const [adding, setAdding] = useState<CapDistance | null>(null);

  const addEntry = (dist: CapDistance, entry: Omit<CardioRecord, "id">) =>
    patch((r) => {
      r.cap[dist] ??= [];
      if (r.cap[dist].length < MAX) r.cap[dist].push({ ...entry, id: uid() });
    });

  const removeEntry = (dist: CapDistance, id: string) =>
    patch((r) => {
      r.cap[dist] = r.cap[dist].filter((e) => e.id !== id);
    });

  return (
    <section>
      <SectionTitle>CAP (course à pied)</SectionTitle>
      <div className="space-y-2">
        {CAP_DISTANCES.map((dist) => {
          const entries = records.cap[dist] ?? [];
          return (
            <div key={dist} className="rounded-xl border border-line bg-surface p-3">
              <div className="mb-2 font-semibold">{dist}</div>
              {entries.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {[...entries]
                    .sort((a, b) => a.timeSeconds - b.timeSeconds)
                    .map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between rounded-lg bg-surface2 px-2.5 py-2 text-sm"
                      >
                        <span className="text-dim">{shortDate(e.date)}</span>
                        <span className="font-bold">{formatTime(e.timeSeconds)}</span>
                        <button
                          onClick={() => removeEntry(dist, e.id)}
                          className="text-dim"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                </div>
              )}
              {entries.length < MAX && adding !== dist && (
                <button
                  onClick={() => setAdding(dist)}
                  className="w-full rounded-lg border border-dashed border-line py-1.5 text-[13px] text-dim"
                >
                  + Ajouter un record
                </button>
              )}
              {adding === dist && (
                <AddCardioForm
                  showHours={dist === "21km" || dist === "42km"}
                  onAdd={(e) => { addEntry(dist, e); setAdding(null); }}
                  onCancel={() => setAdding(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Hyrox ───────────────────────────────────────────────────────────────────

function HyroxSection({
  records,
  patch,
}: {
  records: RecordsData;
  patch: (fn: (r: RecordsData) => void) => void;
}) {
  const [adding, setAdding] = useState<HyroxCategory | null>(null);

  const addEntry = (cat: HyroxCategory, entry: Omit<CardioRecord, "id">) =>
    patch((r) => {
      r.hyrox[cat] ??= [];
      if (r.hyrox[cat].length < MAX) r.hyrox[cat].push({ ...entry, id: uid() });
    });

  const removeEntry = (cat: HyroxCategory, id: string) =>
    patch((r) => {
      r.hyrox[cat] = r.hyrox[cat].filter((e) => e.id !== id);
    });

  return (
    <section>
      <SectionTitle>Hyrox</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {HYROX_CATS.map(({ id, label }) => {
          const entries = records.hyrox[id] ?? [];
          return (
            <div key={id} className="rounded-xl border border-line bg-surface p-3">
              <div className="mb-2 font-semibold">{label}</div>
              {entries.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {[...entries]
                    .sort((a, b) => a.timeSeconds - b.timeSeconds)
                    .map((e) => (
                      <div key={e.id} className="rounded-lg bg-surface2 px-2.5 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-dim">{shortDate(e.date)}</span>
                          <button
                            onClick={() => removeEntry(id, e.id)}
                            className="text-dim"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="font-bold">{formatTime(e.timeSeconds)}</div>
                      </div>
                    ))}
                </div>
              )}
              {entries.length < MAX && adding !== id && (
                <button
                  onClick={() => setAdding(id)}
                  className="w-full rounded-lg border border-dashed border-line py-1.5 text-[13px] text-dim"
                >
                  + Ajouter
                </button>
              )}
              {adding === id && (
                <AddCardioForm
                  showHours
                  onAdd={(e) => { addEntry(id, e); setAdding(null); }}
                  onCancel={() => setAdding(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AddCardioForm({
  showHours,
  onAdd,
  onCancel,
}: {
  showHours: boolean;
  onAdd: (e: Omit<CardioRecord, "id">) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(todayKey());
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("0");
  const [seconds, setSeconds] = useState("0");

  const total =
    (parseInt(hours) || 0) * 3600 +
    (parseInt(minutes) || 0) * 60 +
    (parseInt(seconds) || 0);

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-surface2 p-3">
      <label className="block">
        <span className="mb-1 block text-[12px] text-dim">Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className={`grid gap-2 ${showHours ? "grid-cols-3" : "grid-cols-2"}`}>
        {showHours && (
          <label className="block">
            <span className="mb-1 block text-[12px] text-dim">Heures</span>
            <input type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-[12px] text-dim">Min</span>
          <input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-dim">Sec</span>
          <input type="number" min={0} max={59} value={seconds} onChange={(e) => setSeconds(e.target.value)} />
        </label>
      </div>
      {total > 0 && (
        <p className="text-center text-sm font-bold text-accent">{formatTime(total)}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => onAdd({ date, timeSeconds: total })}
          disabled={total === 0}
          className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-[#1a1500] disabled:opacity-40"
        >
          Valider
        </button>
        <button onClick={onCancel} className="rounded-lg bg-surface px-3 py-2 text-sm text-dim">
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Onglet Tendances ─────────────────────────────────────────────────────────

type ChartSeries = {
  label: string;
  data: { date: string; value: number; label2?: string }[];
  formatY: (v: number) => string;
  lowerIsBetter: boolean;
};

function TendancesTab({
  records,
  library,
}: {
  records: RecordsData;
  library: ExerciseLibrary;
}) {
  const [selected, setSelected] = useState(0);

  const series: ChartSeries[] = [];

  // Musculation : un graphe par exercice avec données
  records.strength
    .filter((r) => (r.visible ?? true) && r.entries.length > 0)
    .forEach((r) => {
      const ex = library.exercises.find((e) => e.id === r.exId);
      if (!ex) return;
      series.push({
        label: ex.name,
        data: r.entries.map((e) => ({
          date: e.date,
          value: e.weight,
          label2: `×${e.reps}`,
        })),
        formatY: (v) => `${v} kg`,
        lowerIsBetter: false,
      });
    });

  // CAP
  CAP_DISTANCES.forEach((dist) => {
    const entries = records.cap[dist] ?? [];
    if (entries.length === 0) return;
    series.push({
      label: `CAP ${dist}`,
      data: entries.map((e) => ({ date: e.date, value: e.timeSeconds })),
      formatY: formatTime,
      lowerIsBetter: true,
    });
  });

  // Hyrox
  HYROX_CATS.forEach(({ id, label }) => {
    const entries = records.hyrox[id] ?? [];
    if (entries.length === 0) return;
    series.push({
      label: `Hyrox ${label}`,
      data: entries.map((e) => ({ date: e.date, value: e.timeSeconds })),
      formatY: formatTime,
      lowerIsBetter: true,
    });
  });

  if (series.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="mb-2 text-3xl">📊</p>
        <p className="text-sm text-dim">Aucun record enregistré.</p>
        <p className="mt-1 text-[13px] text-dim">
          Ajoute des records dans l&apos;onglet "Records" pour voir les tendances.
        </p>
      </div>
    );
  }

  const idx = Math.min(selected, series.length - 1);
  const current = series[idx];

  return (
    <div className="space-y-4">
      {series.length > 1 && (
        <select
          value={idx}
          onChange={(e) => setSelected(Number(e.target.value))}
          className="w-full"
        >
          {series.map((s, i) => (
            <option key={i} value={i}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      <div className="rounded-xl border border-line bg-surface p-4">
        <h3 className="mb-1 font-semibold">{current.label}</h3>
        <p className="mb-4 text-[12px] text-dim">
          {current.lowerIsBetter ? "Meilleur = temps le plus bas" : "Meilleur = poids le plus élevé"}
        </p>
        <MiniChart series={current} />
      </div>
    </div>
  );
}

function MiniChart({ series }: { series: ChartSeries }) {
  const sorted = [...series.data].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return null;

  const W = 300;
  const H = 150;
  const PL = 8, PR = 8, PT = 36, PB = 28;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;

  const values = sorted.map((d) => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);

  const xOf = (i: number) =>
    PL + (sorted.length === 1 ? plotW / 2 : (i / (sorted.length - 1)) * plotW);
  const yOf = (v: number) => {
    if (maxV === minV) return PT + plotH / 2;
    return PT + plotH - ((v - minV) / (maxV - minV)) * plotH;
  };

  const best = series.lowerIsBetter ? Math.min(...values) : Math.max(...values);
  const linePoints = sorted.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(" ");
  const areaPoints = [
    ...sorted.map((d, i) => `${xOf(i)},${yOf(d.value)}`),
    `${xOf(sorted.length - 1)},${PT + plotH}`,
    `${xOf(0)},${PT + plotH}`,
  ].join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {sorted.length > 1 && (
        <>
          <polygon points={areaPoints} fill="url(#cg)" />
          <polyline
            points={linePoints}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      )}

      {sorted.map((d, i) => {
        const cx = xOf(i);
        const cy = yOf(d.value);
        const isBest = d.value === best;
        return (
          <g key={`${d.date}-${i}`}>
            {isBest && (
              <circle
                cx={cx}
                cy={cy}
                r={9}
                fill="none"
                stroke="var(--color-ok)"
                strokeWidth="1.5"
                strokeOpacity="0.5"
              />
            )}
            <circle cx={cx} cy={cy} r={isBest ? 5 : 4} fill={isBest ? "var(--color-ok)" : "var(--color-accent)"} />
            <text
              x={cx}
              y={cy - 12}
              textAnchor="middle"
              fontSize="9"
              fontWeight="bold"
              fill="var(--color-ink)"
            >
              {series.formatY(d.value)}
            </text>
            {d.label2 && (
              <text
                x={cx}
                y={cy - 3}
                textAnchor="middle"
                fontSize="8"
                fill="var(--color-dim)"
              >
                {d.label2}
              </text>
            )}
            <text
              x={cx}
              y={H - 4}
              textAnchor="middle"
              fontSize="9"
              fill="var(--color-dim)"
            >
              {shortDate(d.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Utilitaire ───────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-dim">
      {children}
    </h2>
  );
}
