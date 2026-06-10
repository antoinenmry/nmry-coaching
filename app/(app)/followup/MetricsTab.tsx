"use client";

import { useState, useEffect, useRef } from "react";
import { useData } from "@/components/DataProvider";
import type { Metric, MetricEntry } from "@/lib/types";

// ─── Utils ────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const todayKey = () => new Date().toISOString().slice(0, 10);
const MONTHS_SHORT = ["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];

function fmtDate(d: string) {
  const [, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS_SHORT[m - 1]}`;
}

// ─── Couleurs du graphique ────────────────────────────────────────────────────
const CHART_COLORS = ["#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#f87171", "#fb923c", "#e879f9"];

// ─── Trend ────────────────────────────────────────────────────────────────────
function computeTrend(entries: MetricEntry[]) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;
  const last = sorted[sorted.length - 1].value;
  const prev = sorted[sorted.length - 2].value;
  if (prev === 0) return null;
  const delta = last - prev;
  const pct = (delta / Math.abs(prev)) * 100;
  return { delta, pct, last };
}

function TrendBadge({ entries, unit }: { entries: MetricEntry[]; unit: string }) {
  const t = computeTrend(entries);
  if (!t) return null;
  const isPos = t.pct > 0.05;
  const isNeg = t.pct < -0.05;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[12px] font-bold ${isPos ? "text-ok" : isNeg ? "text-danger" : "text-dim"}`}>
        {isPos ? "↗ +" : isNeg ? "↘ " : "→ "}
        {t.delta > 0 ? "+" : ""}{t.delta.toFixed(1)} {unit}
      </span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
        isPos ? "bg-ok/15 text-ok" : isNeg ? "bg-danger/15 text-danger" : "bg-surface2 text-dim"
      }`}>
        {t.pct > 0 ? "+" : ""}{t.pct.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── SVG Chart ────────────────────────────────────────────────────────────────
type TooltipPoint = { x: number; y: number; value: number; date: string; unit: string };

function MetricChart({ allMetrics, visibleIds, days }: {
  allMetrics: Metric[];
  visibleIds: string[];
  days: number;
}) {
  const [tooltip, setTooltip] = useState<TooltipPoint | null>(null);

  const W = 300, H = 140;
  const PAD = { t: 10, r: 10, b: 22, l: 36 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;

  const cutoff = days > 0
    ? new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
    : "0000-00-00";

  const lines = allMetrics
    .map((m, idx) => ({
      m,
      color: CHART_COLORS[idx % CHART_COLORS.length],
      pts: [...m.entries]
        .filter(e => e.date >= cutoff)
        .sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .filter(({ m, pts }) => visibleIds.includes(m.id) && pts.length > 0);

  if (lines.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center text-sm text-dim">
        Aucune donnée pour cette période
      </div>
    );
  }

  const allDates = lines.flatMap(({ pts }) => pts.map(p => p.date)).sort();
  const dMin = allDates[0];
  const dMax = allDates[allDates.length - 1];
  const tMin = new Date(dMin).getTime();
  const tMax = new Date(dMax).getTime();
  const tRange = tMax - tMin || 1;

  // Échelle Y globale (toutes les courbes visibles)
  const allVals = lines.flatMap(({ pts }) => pts.map(p => p.value));
  const gMin = Math.min(...allVals);
  const gMax = Math.max(...allVals);
  const gRange = gMax - gMin || 1;

  function xOf(date: string) {
    return PAD.l + ((new Date(date).getTime() - tMin) / tRange) * cW;
  }

  function yOf(val: number) {
    return PAD.t + cH - ((val - gMin) / gRange) * cH;
  }

  // Ticks Y : 3 valeurs (min, milieu, max)
  const yTicks = [gMax, (gMin + gMax) / 2, gMin];

  // Ticks X : début, milieu, fin
  const tMid = (tMin + tMax) / 2;
  const dMid = new Date(tMid).toISOString().slice(0, 10);
  const xTicks = dMin === dMax
    ? [{ d: dMin, x: xOf(dMin), anchor: "middle" as const }]
    : [
        { d: dMin, x: xOf(dMin), anchor: "start" as const },
        ...(tRange > 4 * 86_400_000 ? [{ d: dMid, x: xOf(dMid), anchor: "middle" as const }] : []),
        { d: dMax, x: xOf(dMax), anchor: "end" as const },
      ];

  const firstUnit = lines[0]?.m.unit ?? "";

  // Tooltip: positionner en haut si le point est dans la moitié basse
  const ttAbove = tooltip ? tooltip.y > PAD.t + cH / 2 : false;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onClick={() => setTooltip(null)}>
      {/* Grille horizontale */}
      {yTicks.map((v, i) => (
        <line
          key={i}
          x1={PAD.l} x2={W - PAD.r}
          y1={yOf(v)} y2={yOf(v)}
          stroke="currentColor" strokeWidth="0.5" opacity="0.1"
        />
      ))}

      {/* Labels axe Y */}
      {yTicks.map((v, i) => (
        <text
          key={i}
          x={PAD.l - 4}
          y={yOf(v) + 3}
          fontSize="7.5"
          fill="currentColor"
          opacity="0.45"
          textAnchor="end"
        >
          {Number.isInteger(v) ? v : v.toFixed(1)}{lines.length === 1 ? ` ${firstUnit}` : ""}
        </text>
      ))}

      {/* Courbes */}
      {lines.map(({ m, color, pts }) => {
        const points = pts.map(p => ({ x: xOf(p.date), y: yOf(p.value), value: p.value, date: p.date }));
        const d = points
          .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" ");
        return (
          <g key={m.id}>
            <path
              d={`${d} L${points[points.length - 1].x.toFixed(1)},${(PAD.t + cH).toFixed(1)} L${points[0].x.toFixed(1)},${(PAD.t + cH).toFixed(1)} Z`}
              fill={color} opacity="0.06"
            />
            <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="4"
                fill={color} fillOpacity="0"
                stroke="transparent" strokeWidth="8"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setTooltip(t => t?.date === p.date && t?.value === p.value ? null : { x: p.x, y: p.y, value: p.value, date: p.date, unit: m.unit });
                }}
              />
            ))}
            {points.map((p, i) => (
              <circle key={`dot-${i}`} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2.5" fill={color} style={{ pointerEvents: "none" }} />
            ))}
          </g>
        );
      })}

      {/* Labels axe X */}
      {xTicks.map(({ d, x, anchor }) => (
        <text key={d} x={x.toFixed(1)} y={H - 4} fontSize="8" fill="currentColor" opacity="0.4" textAnchor={anchor}>
          {fmtDate(d)}
        </text>
      ))}

      {/* Tooltip */}
      {tooltip && (() => {
        const tw = 76, th = 28;
        const tx = Math.min(Math.max(tooltip.x - tw / 2, PAD.l), W - PAD.r - tw);
        const ty = ttAbove ? tooltip.y - th - 8 : tooltip.y + 8;
        const label = `${Number.isInteger(tooltip.value) ? tooltip.value : tooltip.value.toFixed(1)} ${tooltip.unit}`;
        return (
          <g style={{ pointerEvents: "none" }}>
            <rect x={tx} y={ty} width={tw} height={th} rx="4" fill="var(--color-surface)" stroke="var(--color-line)" strokeWidth="0.5" />
            <text x={tx + tw / 2} y={ty + 10} fontSize="7.5" fill="currentColor" opacity="0.55" textAnchor="middle">{fmtDate(tooltip.date)}</text>
            <text x={tx + tw / 2} y={ty + 21} fontSize="9" fontWeight="600" fill="currentColor" textAnchor="middle">{label}</text>
          </g>
        );
      })()}
    </svg>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function MetricsTab() {
  const { state, update } = useData();
  const initializedRef = useRef(false);

  const [subTab, setSubTab] = useState<"donnees" | "tendances">("donnees");
  const [visibleChartIds, setVisibleChartIds] = useState<string[]>([]);
  const [chartDays, setChartDays] = useState(30);

  // Initialisation : migre height/weight du profil + crée métriques par défaut
  useEffect(() => {
    if (initializedRef.current || state.metrics !== undefined) return;
    initializedRef.current = true;

    const w = parseFloat(state.profile.weight ?? "");
    const h = parseFloat(state.profile.height ?? "");

    const defaults: Metric[] = [
      {
        id: "metric-poids",
        name: "Poids",
        unit: "kg",
        emoji: "⚖️",
        visible: true,
        entries: !isNaN(w) && w > 0
          ? [{ id: uid(), date: todayKey(), value: w }]
          : [],
      },
      {
        id: "metric-taille",
        name: "Taille",
        unit: "cm",
        emoji: "📏",
        visible: true,
        entries: !isNaN(h) && h > 0
          ? [{ id: uid(), date: todayKey(), value: h }]
          : [],
      },
    ];
    update(d => { d.metrics = defaults; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sélectionner toutes les métriques par défaut pour le graphique
  useEffect(() => {
    if (visibleChartIds.length === 0 && (state.metrics?.length ?? 0) > 0) {
      setVisibleChartIds((state.metrics ?? []).map(m => m.id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.metrics?.length]);

  const metrics = state.metrics ?? [];

  // ── État sous-onglet Données ───────────────────────────────────────────────
  const [addingEntryFor, setAddingEntryFor] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(todayKey());
  const [entryValue, setEntryValue] = useState("");
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [addingMetric, setAddingMetric] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newEmoji, setNewEmoji] = useState("📊");

  function saveEntry(metricId: string) {
    const v = parseFloat(entryValue);
    if (isNaN(v)) return;
    update(d => {
      const m = (d.metrics ?? []).find(x => x.id === metricId);
      if (!m) return;
      // Remplace l'entrée du même jour si elle existe
      m.entries = m.entries.filter(e => e.date !== entryDate);
      m.entries.push({ id: uid(), date: entryDate, value: v });
      m.entries.sort((a, b) => a.date.localeCompare(b.date));
    });
    setAddingEntryFor(null);
    setEntryValue("");
    setEntryDate(todayKey());
  }

  function deleteEntry(metricId: string, entryId: string) {
    update(d => {
      const m = (d.metrics ?? []).find(x => x.id === metricId);
      if (m) m.entries = m.entries.filter(e => e.id !== entryId);
    });
  }

  function saveMetricEdit(metricId: string) {
    update(d => {
      const m = (d.metrics ?? []).find(x => x.id === metricId);
      if (!m) return;
      if (editName) m.name = editName;
      if (editUnit) m.unit = editUnit;
      if (editEmoji) m.emoji = editEmoji;
    });
    setEditingMetricId(null);
  }

  function deleteMetric(metricId: string) {
    update(d => { d.metrics = (d.metrics ?? []).filter(x => x.id !== metricId); });
    setVisibleChartIds(v => v.filter(id => id !== metricId));
  }

  function addMetric() {
    if (!newName.trim() || !newUnit.trim()) return;
    const m: Metric = {
      id: uid(),
      name: newName.trim(),
      unit: newUnit.trim(),
      emoji: newEmoji || "📊",
      visible: true,
      entries: [],
    };
    update(d => { d.metrics = [...(d.metrics ?? []), m]; });
    setVisibleChartIds(v => [...v, m.id]);
    setNewName(""); setNewUnit(""); setNewEmoji("📊");
    setAddingMetric(false);
  }

  const PERIODS = [
    { label: "1 mois", days: 30 },
    { label: "3 mois", days: 90 },
    { label: "6 mois", days: 180 },
    { label: "Tout", days: 0 },
  ];

  return (
    <div className="space-y-4">
      {/* Switch sous-onglets */}
      <div className="flex rounded-xl bg-surface2 p-1">
        {(["donnees", "tendances"] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition ${
              subTab === t ? "bg-surface text-ink shadow-sm" : "text-dim"
            }`}
          >
            {t === "donnees" ? "📋 Données" : "📈 Tendances"}
          </button>
        ))}
      </div>

      {/* ── Sous-onglet Données ─────────────────────────────────────────────── */}
      {subTab === "donnees" && (
        <div className="space-y-3">
          {metrics.length === 0 && !addingMetric && (
            <p className="py-8 text-center text-sm text-dim">Aucune métrique pour l&apos;instant.</p>
          )}

          {metrics.map(m => {
            const sorted = [...m.entries].sort((a, b) => b.date.localeCompare(a.date));
            const last = sorted[0];
            const isAddingEntry = addingEntryFor === m.id;
            const isEditingThis = editingMetricId === m.id;

            return (
              <div key={m.id} className="rounded-2xl border border-line bg-surface p-4">
                {/* Mode édition de la métrique */}
                {isEditingThis ? (
                  <div className="space-y-3">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-accent">Modifier la métrique</p>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[12px] text-dim">Emoji</span>
                        <input value={editEmoji} onChange={e => setEditEmoji(e.target.value)} className="text-center text-lg" />
                      </label>
                      <label className="col-span-2 block">
                        <span className="mb-1 block text-[12px] text-dim">Nom</span>
                        <input value={editName} onChange={e => setEditName(e.target.value)} />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-dim">Unité (kg, cm, %, bpm…)</span>
                      <input value={editUnit} onChange={e => setEditUnit(e.target.value)} placeholder="kg" />
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveMetricEdit(m.id)}
                        className="flex-1 rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-[#1a1500]"
                      >
                        ✓ Enregistrer
                      </button>
                      <button
                        onClick={() => setEditingMetricId(null)}
                        className="rounded-xl bg-surface2 px-4 py-2.5 text-[13px] text-dim"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => { deleteMetric(m.id); setEditingMetricId(null); }}
                        className="rounded-xl px-4 py-2.5 text-[13px] text-danger"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Header : emoji + nom + dernière valeur */}
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl leading-none">{m.emoji ?? "📊"}</span>
                        <div>
                          <p className="font-bold leading-tight">{m.name}</p>
                          {last ? (
                            <p className="text-[13px] font-semibold">
                              {last.value} <span className="text-dim font-normal">{m.unit}</span>
                              <span className="ml-2 text-[11px] font-normal text-dim">{fmtDate(last.date)}</span>
                            </p>
                          ) : (
                            <p className="text-[12px] text-dim">Aucune entrée</p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <TrendBadge entries={m.entries} unit={m.unit} />
                        <button
                          onClick={() => {
                            setEditingMetricId(m.id);
                            setEditName(m.name);
                            setEditUnit(m.unit);
                            setEditEmoji(m.emoji ?? "📊");
                          }}
                          className="text-[11px] text-dim hover:text-ink"
                        >
                          ✏️
                        </button>
                      </div>
                    </div>

                    {/* Historique (3 dernières entrées) */}
                    {sorted.length > 1 && (
                      <div className="mb-3 space-y-1 rounded-xl bg-surface2 px-3 py-2">
                        {sorted.slice(0, 3).map(e => (
                          <div key={e.id} className="flex items-center justify-between text-[12px]">
                            <span className="text-dim">{fmtDate(e.date)}</span>
                            <span className="font-semibold text-ink">{e.value} {m.unit}</span>
                            <button
                              onClick={() => deleteEntry(m.id, e.id)}
                              className="text-[10px] text-dim hover:text-danger"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Formulaire ajout d'entrée */}
                    {isAddingEntry ? (
                      <div className="space-y-2.5 rounded-xl border border-line bg-surface2 p-3">
                        <p className="text-[12px] font-semibold text-dim">Nouvelle entrée</p>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="mb-1 block text-[12px] text-dim">Date</span>
                            <input
                              type="date"
                              value={entryDate}
                              onChange={e => setEntryDate(e.target.value)}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[12px] text-dim">Valeur ({m.unit})</span>
                            <input
                              type="number"
                              step="0.1"
                              value={entryValue}
                              onChange={e => setEntryValue(e.target.value)}
                              placeholder="ex : 82.5"
                              autoFocus
                            />
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEntry(m.id)}
                            disabled={!entryValue}
                            className="flex-1 rounded-xl bg-accent py-2 text-[13px] font-semibold text-[#1a1500] disabled:opacity-40"
                          >
                            ✓ Enregistrer
                          </button>
                          <button
                            onClick={() => { setAddingEntryFor(null); setEntryValue(""); }}
                            className="rounded-xl bg-surface px-4 py-2 text-[13px] text-dim"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAddingEntryFor(m.id);
                          setEntryDate(todayKey());
                          setEntryValue("");
                        }}
                        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2 text-[13px] font-semibold text-dim transition hover:border-accent/40 hover:text-accent"
                      >
                        + Entrée
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* Formulaire nouvelle métrique */}
          {addingMetric ? (
            <div className="rounded-2xl border border-accent/30 bg-surface p-4 space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-accent">Nouvelle métrique</p>
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[12px] text-dim">Emoji</span>
                  <input
                    value={newEmoji}
                    onChange={e => setNewEmoji(e.target.value)}
                    className="text-center text-lg"
                  />
                </label>
                <label className="col-span-2 block">
                  <span className="mb-1 block text-[12px] text-dim">Nom *</span>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Tour de taille"
                    autoFocus
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[12px] text-dim">Unité *</span>
                <input
                  value={newUnit}
                  onChange={e => setNewUnit(e.target.value)}
                  placeholder="cm, kg, %, bpm…"
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={addMetric}
                  disabled={!newName.trim() || !newUnit.trim()}
                  className="flex-1 rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-[#1a1500] disabled:opacity-40"
                >
                  ✓ Créer
                </button>
                <button
                  onClick={() => setAddingMetric(false)}
                  className="rounded-xl bg-surface2 px-4 py-2.5 text-[13px] text-dim"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingMetric(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-3.5 text-[13px] font-semibold text-dim transition hover:border-accent/40 hover:text-accent"
            >
              ＋ Nouvelle métrique
            </button>
          )}
        </div>
      )}

      {/* ── Sous-onglet Tendances ───────────────────────────────────────────── */}
      {subTab === "tendances" && (
        <div className="space-y-4">
          {/* Toggles métriques */}
          {metrics.length === 0 ? (
            <p className="py-8 text-center text-sm text-dim">
              Ajoute des métriques dans l&apos;onglet Données pour voir les tendances.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {metrics.map((m, idx) => {
                  const active = visibleChartIds.includes(m.id);
                  const color = CHART_COLORS[idx % CHART_COLORS.length];
                  return (
                    <button
                      key={m.id}
                      onClick={() =>
                        setVisibleChartIds(v =>
                          v.includes(m.id) ? v.filter(id => id !== m.id) : [...v, m.id]
                        )
                      }
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                        active ? "border-transparent text-[#06121f]" : "border-line bg-surface2 text-dim"
                      }`}
                      style={active ? { background: color } : {}}
                    >
                      {m.emoji ?? "📊"} {m.name}
                    </button>
                  );
                })}
              </div>

              {/* Graphique */}
              <div className="rounded-2xl border border-line bg-surface p-4">
                <MetricChart allMetrics={metrics} visibleIds={visibleChartIds} days={chartDays} />
              </div>

              {/* Légende avec dernière valeur */}
              {visibleChartIds.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {metrics
                    .filter(m => visibleChartIds.includes(m.id))
                    .map(m => {
                      const sorted = [...m.entries].sort((a, b) => b.date.localeCompare(a.date));
                      const last = sorted[0];
                      const idx = metrics.indexOf(m);
                      return (
                        <div key={m.id} className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                          <span className="text-[12px] text-dim">
                            {m.emoji} {m.name}
                            {last && (
                              <span className="ml-1 font-semibold text-ink">
                                {last.value} {m.unit}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Sélecteur de période */}
              <div className="flex rounded-xl bg-surface2 p-1">
                {PERIODS.map(p => (
                  <button
                    key={p.days}
                    onClick={() => setChartDays(p.days)}
                    className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition ${
                      chartDays === p.days ? "bg-accent text-[#1a1500]" : "text-dim"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
