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

type SportId = "strength" | "cap" | "hyrox";

const CAP_DISTANCES: CapDistance[] = ["1km", "5km", "10km", "21km", "42km"];
const HYROX_CATS: { id: HyroxCategory; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "pro", label: "Pro" },
];
const SPORT_META: { id: SportId; icon: string; label: string }[] = [
  { id: "strength", icon: "🏋️", label: "Musculation" },
  { id: "cap", icon: "🏃", label: "CAP (course à pied)" },
  { id: "hyrox", icon: "⚡", label: "Hyrox" },
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

// Backward compat : dérive les actifs depuis les données legacy
function getActiveSports(r: RecordsData): SportId[] {
  if (r.activeSports !== undefined) return r.activeSports;
  const out: SportId[] = [];
  if (r.strength.some((x) => x.visible)) out.push("strength");
  if (CAP_DISTANCES.some((d) => (r.cap[d] ?? []).length > 0)) out.push("cap");
  if (HYROX_CATS.some(({ id }) => (r.hyrox[id] ?? []).length > 0)) out.push("hyrox");
  return out;
}
function getActiveCap(r: RecordsData): CapDistance[] {
  if (r.activeCap !== undefined) return r.activeCap;
  return CAP_DISTANCES.filter((d) => (r.cap[d] ?? []).length > 0);
}
function getActiveHyrox(r: RecordsData): HyroxCategory[] {
  if (r.activeHyrox !== undefined) return r.activeHyrox;
  return HYROX_CATS.map(({ id }) => id).filter((id) => (r.hyrox[id] ?? []).length > 0);
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function RecordsPage() {
  const { state, update } = useData();
  const [tab, setTab] = useState<"records" | "tendances">("records");

  const records: RecordsData = state.records ?? emptyRecords();
  const patch = (fn: (r: RecordsData) => void) =>
    update((d) => { d.records ??= emptyRecords(); fn(d.records); });

  return (
    <div className="space-y-4">
      <div className="flex rounded-2xl bg-surface2 p-1">
        {(["records", "tendances"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
              tab === t ? "bg-accent text-[#1a1500] shadow-sm" : "text-dim"
            }`}
          >
            {t === "records" ? "🏆 Records" : "📊 Tendances"}
          </button>
        ))}
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
  const [sportPickerOpen, setSportPickerOpen] = useState(false);
  const activeSports = getActiveSports(records);
  const allAdded = activeSports.length === SPORT_META.length;

  const addSport = (id: SportId) =>
    patch((r) => { r.activeSports = [...getActiveSports(r), id]; });

  const removeSport = (id: SportId) =>
    patch((r) => { r.activeSports = getActiveSports(r).filter((s) => s !== id); });

  return (
    <div className="space-y-4">
      {activeSports.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="text-5xl">🏆</span>
          <p className="font-semibold">Aucun sport configuré</p>
          <p className="text-sm text-dim">Ajoute un sport pour commencer à suivre tes records.</p>
        </div>
      )}

      {activeSports.includes("strength") && (
        <StrengthSection
          records={records}
          patch={patch}
          library={library}
          onRemoveSport={() => removeSport("strength")}
        />
      )}
      {activeSports.includes("cap") && (
        <CapSection
          records={records}
          patch={patch}
          onRemoveSport={() => removeSport("cap")}
        />
      )}
      {activeSports.includes("hyrox") && (
        <HyroxSection
          records={records}
          patch={patch}
          onRemoveSport={() => removeSport("hyrox")}
        />
      )}

      {!allAdded && (
        <button
          onClick={() => setSportPickerOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-4 text-sm font-semibold text-dim transition hover:border-accent hover:text-accent"
        >
          + Ajouter un sport
        </button>
      )}

      {sportPickerOpen && (
        <SportPickerModal
          activeSports={activeSports}
          onAdd={(id) => { addSport(id); setSportPickerOpen(false); }}
          onClose={() => setSportPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Modale : choisir un sport ────────────────────────────────────────────────
function SportPickerModal({
  activeSports,
  onAdd,
  onClose,
}: {
  activeSports: SportId[];
  onAdd: (id: SportId) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">Ajouter un sport</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 text-dim">✕</button>
        </div>
        <div className="space-y-2">
          {SPORT_META.map(({ id, icon, label }) => {
            const already = activeSports.includes(id);
            return (
              <button
                key={id}
                onClick={() => !already && onAdd(id)}
                disabled={already}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left font-semibold transition ${
                  already
                    ? "cursor-not-allowed border-line bg-surface2 text-dim opacity-50"
                    : "border-line bg-surface hover:border-accent hover:bg-accent/5"
                }`}
              >
                <span className="text-xl">{icon}</span>
                <span className="flex-1">{label}</span>
                {already && <span className="text-xs font-normal text-dim">Déjà ajouté</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Section Musculation ──────────────────────────────────────────────────────
function StrengthSection({
  records,
  patch,
  library,
  onRemoveSport,
}: {
  records: RecordsData;
  patch: (fn: (r: RecordsData) => void) => void;
  library: ExerciseLibrary;
  onRemoveSport: () => void;
}) {
  const [exPickerOpen, setExPickerOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const visibleExercises = records.strength.filter((r) => r.visible);

  const addExercise = (exId: string, name: string) =>
    patch((r) => {
      const exists = r.strength.find((x) => x.exId === exId);
      if (exists) { exists.visible = true; return; }
      r.strength.push({ exId, name, visible: true, entries: [] });
    });

  const removeExercise = (exId: string) =>
    patch((r) => {
      const ex = r.strength.find((x) => x.exId === exId);
      if (ex) ex.visible = false;
    });

  const addEntry = (exId: string, entry: Omit<StrengthRecord, "id">) =>
    patch((r) => {
      const ex = r.strength.find((x) => x.exId === exId);
      if (ex && ex.entries.length < MAX) ex.entries.push({ ...entry, id: uid() });
    });

  const removeEntry = (exId: string, entryId: string) =>
    patch((r) => {
      const ex = r.strength.find((x) => x.exId === exId);
      if (ex) ex.entries = ex.entries.filter((e) => e.id !== entryId);
    });

  const getExName = (exId: string, saved?: string) =>
    library.exercises.find((e) => e.id === exId)?.name ?? saved ?? exId;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">🏋️ Musculation</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExPickerOpen(true)}
            className="rounded-lg bg-accent/15 px-3 py-1.5 text-[13px] font-semibold text-accent"
          >
            + Ajouter
          </button>
          <button
            onClick={() => setConfirmRemove(true)}
            className="grid h-7 w-7 place-items-center rounded-lg bg-surface2 text-sm text-dim hover:bg-danger/20 hover:text-danger"
          >
            🗑
          </button>
        </div>
      </div>

      {visibleExercises.length === 0 ? (
        <p className="py-4 text-center text-sm text-dim">Aucun exercice ajouté.</p>
      ) : (
        <div className="space-y-3">
          {visibleExercises.map((rec) => {
            const name = getExName(rec.exId, rec.name);
            const entries = rec.entries ?? [];
            return (
              <div key={rec.exId} className="rounded-xl border border-line bg-surface2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{name}</span>
                  <button
                    onClick={() => { removeExercise(rec.exId); if (adding === rec.exId) setAdding(null); }}
                    className="text-[12px] text-dim hover:text-danger"
                  >
                    ✕
                  </button>
                </div>
                {entries.length > 0 && (
                  <div className="mb-2 space-y-1.5">
                    {[...entries].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                      <div key={e.id} className="flex items-center justify-between rounded-lg bg-surface px-2.5 py-2 text-sm">
                        <span className="text-dim">{shortDate(e.date)}</span>
                        <span className="font-bold">{e.weight} kg × {e.reps} rép.</span>
                        <button onClick={() => removeEntry(rec.exId, e.id)} className="text-dim">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {entries.length < MAX && adding !== rec.exId && (
                  <button
                    onClick={() => setAdding(rec.exId)}
                    className="w-full rounded-lg border border-dashed border-line py-1.5 text-[13px] text-dim"
                  >
                    + Ajouter un record
                  </button>
                )}
                {adding === rec.exId && (
                  <AddStrengthForm
                    onAdd={(e) => { addEntry(rec.exId, e); setAdding(null); }}
                    onCancel={() => setAdding(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {exPickerOpen && (
        <ExercisePickerModal
          library={library}
          addedIds={visibleExercises.map((r) => r.exId)}
          onAdd={(exId, name) => { addExercise(exId, name); setExPickerOpen(false); }}
          onClose={() => setExPickerOpen(false)}
        />
      )}
      {confirmRemove && (
        <ConfirmRemoveModal
          label="Musculation"
          onConfirm={() => { onRemoveSport(); setConfirmRemove(false); }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </section>
  );
}

// ─── Modale : choisir exercice ────────────────────────────────────────────────
function ExercisePickerModal({
  library,
  addedIds,
  onAdd,
  onClose,
}: {
  library: ExerciseLibrary;
  addedIds: string[];
  onAdd: (exId: string, name: string) => void;
  onClose: () => void;
}) {
  const [customName, setCustomName] = useState("");

  const submit = () => {
    if (customName.trim()) { onAdd(uid(), customName.trim()); setCustomName(""); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">Ajouter un exercice</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 text-dim">✕</button>
        </div>

        {library.exercises.length > 0 && (
          <>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-dim">Bibliothèque</p>
            <div className="mb-4 space-y-1.5">
              {library.exercises.map((ex) => {
                const already = addedIds.includes(ex.id);
                return (
                  <button
                    key={ex.id}
                    onClick={() => !already && onAdd(ex.id, ex.name)}
                    disabled={already}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      already
                        ? "cursor-not-allowed border-line bg-surface2 text-dim opacity-50"
                        : "border-line bg-surface hover:border-accent"
                    }`}
                  >
                    <span>{ex.name}</span>
                    {already && <span className="text-xs text-dim">Déjà ajouté</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-dim">Exercice personnalisé</p>
        <div className="flex gap-2">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Nom de l'exercice…"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button
            onClick={submit}
            disabled={!customName.trim()}
            className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-[#1a1500] disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section CAP ──────────────────────────────────────────────────────────────
function CapSection({
  records,
  patch,
  onRemoveSport,
}: {
  records: RecordsData;
  patch: (fn: (r: RecordsData) => void) => void;
  onRemoveSport: () => void;
}) {
  const [distPickerOpen, setDistPickerOpen] = useState(false);
  const [adding, setAdding] = useState<CapDistance | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const activeCap = getActiveCap(records);

  const addDistance = (dist: CapDistance) =>
    patch((r) => { r.activeCap = [...getActiveCap(r), dist]; });

  const removeDistance = (dist: CapDistance) =>
    patch((r) => { r.activeCap = getActiveCap(r).filter((d) => d !== dist); });

  const addEntry = (dist: CapDistance, entry: Omit<CardioRecord, "id">) =>
    patch((r) => {
      r.cap[dist] ??= [];
      if (r.cap[dist].length < MAX) r.cap[dist].push({ ...entry, id: uid() });
    });

  const removeEntry = (dist: CapDistance, id: string) =>
    patch((r) => { r.cap[dist] = r.cap[dist].filter((e) => e.id !== id); });

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">🏃 CAP (course à pied)</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDistPickerOpen(true)}
            disabled={activeCap.length === CAP_DISTANCES.length}
            className="rounded-lg bg-accent/15 px-3 py-1.5 text-[13px] font-semibold text-accent disabled:opacity-40"
          >
            + Ajouter
          </button>
          <button
            onClick={() => setConfirmRemove(true)}
            className="grid h-7 w-7 place-items-center rounded-lg bg-surface2 text-sm text-dim hover:bg-danger/20 hover:text-danger"
          >
            🗑
          </button>
        </div>
      </div>

      {activeCap.length === 0 ? (
        <p className="py-4 text-center text-sm text-dim">Aucune distance ajoutée.</p>
      ) : (
        <div className="space-y-3">
          {activeCap.map((dist) => {
            const entries = records.cap[dist] ?? [];
            return (
              <div key={dist} className="rounded-xl border border-line bg-surface2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{dist}</span>
                  <button
                    onClick={() => { removeDistance(dist); if (adding === dist) setAdding(null); }}
                    className="text-[12px] text-dim hover:text-danger"
                  >
                    ✕
                  </button>
                </div>
                {entries.length > 0 && (
                  <div className="mb-2 space-y-1.5">
                    {[...entries].sort((a, b) => a.timeSeconds - b.timeSeconds).map((e) => (
                      <div key={e.id} className="flex items-center justify-between rounded-lg bg-surface px-2.5 py-2 text-sm">
                        <span className="text-dim">{shortDate(e.date)}</span>
                        <span className="font-bold">{formatTime(e.timeSeconds)}</span>
                        <button onClick={() => removeEntry(dist, e.id)} className="text-dim">✕</button>
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
      )}

      {distPickerOpen && (
        <DistancePickerModal
          activeCap={activeCap}
          onAdd={(dist) => { addDistance(dist); setDistPickerOpen(false); }}
          onClose={() => setDistPickerOpen(false)}
        />
      )}
      {confirmRemove && (
        <ConfirmRemoveModal
          label="CAP"
          onConfirm={() => { onRemoveSport(); setConfirmRemove(false); }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </section>
  );
}

// ─── Modale : choisir distance ────────────────────────────────────────────────
function DistancePickerModal({
  activeCap,
  onAdd,
  onClose,
}: {
  activeCap: CapDistance[];
  onAdd: (dist: CapDistance) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">Ajouter une distance</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 text-dim">✕</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {CAP_DISTANCES.map((dist) => {
            const already = activeCap.includes(dist);
            return (
              <button
                key={dist}
                onClick={() => !already && onAdd(dist)}
                disabled={already}
                className={`rounded-xl border px-5 py-2.5 text-sm font-semibold transition ${
                  already
                    ? "cursor-not-allowed border-line bg-surface2 text-dim opacity-50"
                    : "border-line bg-surface hover:border-accent hover:text-accent"
                }`}
              >
                {dist}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Section Hyrox ────────────────────────────────────────────────────────────
function HyroxSection({
  records,
  patch,
  onRemoveSport,
}: {
  records: RecordsData;
  patch: (fn: (r: RecordsData) => void) => void;
  onRemoveSport: () => void;
}) {
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [adding, setAdding] = useState<HyroxCategory | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const activeHyrox = getActiveHyrox(records);

  const addCat = (cat: HyroxCategory) =>
    patch((r) => { r.activeHyrox = [...getActiveHyrox(r), cat]; });

  const removeCat = (cat: HyroxCategory) =>
    patch((r) => { r.activeHyrox = getActiveHyrox(r).filter((c) => c !== cat); });

  const addEntry = (cat: HyroxCategory, entry: Omit<CardioRecord, "id">) =>
    patch((r) => {
      r.hyrox[cat] ??= [];
      if (r.hyrox[cat].length < MAX) r.hyrox[cat].push({ ...entry, id: uid() });
    });

  const removeEntry = (cat: HyroxCategory, id: string) =>
    patch((r) => { r.hyrox[cat] = r.hyrox[cat].filter((e) => e.id !== id); });

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">⚡ Hyrox</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCatPickerOpen(true)}
            disabled={activeHyrox.length === HYROX_CATS.length}
            className="rounded-lg bg-accent/15 px-3 py-1.5 text-[13px] font-semibold text-accent disabled:opacity-40"
          >
            + Ajouter
          </button>
          <button
            onClick={() => setConfirmRemove(true)}
            className="grid h-7 w-7 place-items-center rounded-lg bg-surface2 text-sm text-dim hover:bg-danger/20 hover:text-danger"
          >
            🗑
          </button>
        </div>
      </div>

      {activeHyrox.length === 0 ? (
        <p className="py-4 text-center text-sm text-dim">Aucune catégorie ajoutée.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {activeHyrox.map((cat) => {
            const label = HYROX_CATS.find((c) => c.id === cat)?.label ?? cat;
            const entries = records.hyrox[cat] ?? [];
            return (
              <div key={cat} className="rounded-xl border border-line bg-surface2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{label}</span>
                  <button
                    onClick={() => { removeCat(cat); if (adding === cat) setAdding(null); }}
                    className="text-[12px] text-dim hover:text-danger"
                  >
                    ✕
                  </button>
                </div>
                {entries.length > 0 && (
                  <div className="mb-2 space-y-1.5">
                    {[...entries].sort((a, b) => a.timeSeconds - b.timeSeconds).map((e) => (
                      <div key={e.id} className="rounded-lg bg-surface px-2.5 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-dim">{shortDate(e.date)}</span>
                          <button onClick={() => removeEntry(cat, e.id)} className="text-[11px] text-dim">✕</button>
                        </div>
                        <div className="font-bold">{formatTime(e.timeSeconds)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {entries.length < MAX && adding !== cat && (
                  <button
                    onClick={() => setAdding(cat)}
                    className="w-full rounded-lg border border-dashed border-line py-1.5 text-[13px] text-dim"
                  >
                    + Ajouter
                  </button>
                )}
                {adding === cat && (
                  <AddCardioForm
                    showHours
                    onAdd={(e) => { addEntry(cat, e); setAdding(null); }}
                    onCancel={() => setAdding(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {catPickerOpen && (
        <HyroxPickerModal
          activeHyrox={activeHyrox}
          onAdd={(cat) => { addCat(cat); setCatPickerOpen(false); }}
          onClose={() => setCatPickerOpen(false)}
        />
      )}
      {confirmRemove && (
        <ConfirmRemoveModal
          label="Hyrox"
          onConfirm={() => { onRemoveSport(); setConfirmRemove(false); }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </section>
  );
}

// ─── Modale : choisir catégorie Hyrox ────────────────────────────────────────
function HyroxPickerModal({
  activeHyrox,
  onAdd,
  onClose,
}: {
  activeHyrox: HyroxCategory[];
  onAdd: (cat: HyroxCategory) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">Ajouter une catégorie</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 text-dim">✕</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {HYROX_CATS.map(({ id, label }) => {
            const already = activeHyrox.includes(id);
            return (
              <button
                key={id}
                onClick={() => !already && onAdd(id)}
                disabled={already}
                className={`rounded-xl border px-5 py-2.5 text-sm font-semibold transition ${
                  already
                    ? "cursor-not-allowed border-line bg-surface2 text-dim opacity-50"
                    : "border-line bg-surface hover:border-accent hover:text-accent"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Modale : confirmer suppression sport ─────────────────────────────────────
function ConfirmRemoveModal({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-sm rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <h2 className="mb-2 text-lg font-bold text-danger">Retirer {label} ?</h2>
        <p className="mb-5 text-sm text-dim">
          La section sera masquée. Les records enregistrés sont conservés.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-line py-3 text-sm font-semibold">
            Annuler
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-danger py-3 text-sm font-semibold text-white">
            Retirer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Formulaire musculation ───────────────────────────────────────────────────
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
    <div className="mt-2 space-y-2 rounded-lg bg-surface p-3">
      <label className="block">
        <span className="mb-1 block text-[12px] text-dim">Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[12px] text-dim">Poids (kg)</span>
          <input type="number" min={0} step={0.5} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-dim">Répétitions</span>
          <input type="number" min={1} value={reps} onChange={(e) => setReps(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onAdd({ date, weight: parseFloat(weight) || 0, reps: parseInt(reps) || 1 })}
          disabled={!weight || parseFloat(weight) <= 0}
          className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-[#1a1500] disabled:opacity-40"
        >
          Valider
        </button>
        <button onClick={onCancel} className="rounded-lg bg-surface2 px-3 py-2 text-sm text-dim">
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Formulaire cardio ────────────────────────────────────────────────────────
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
    <div className="mt-2 space-y-2 rounded-lg bg-surface p-3">
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
        <button onClick={onCancel} className="rounded-lg bg-surface2 px-3 py-2 text-sm text-dim">
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
  const activeSports = getActiveSports(records);
  const activeCap = getActiveCap(records);
  const activeHyrox = getActiveHyrox(records);

  const series: ChartSeries[] = [];

  if (activeSports.includes("strength")) {
    records.strength
      .filter((r) => r.visible && r.entries.length > 0)
      .forEach((r) => {
        const name = library.exercises.find((e) => e.id === r.exId)?.name ?? r.name ?? r.exId;
        series.push({
          label: name,
          data: r.entries.map((e) => ({ date: e.date, value: e.weight, label2: `×${e.reps}` })),
          formatY: (v) => `${v} kg`,
          lowerIsBetter: false,
        });
      });
  }

  if (activeSports.includes("cap")) {
    activeCap.forEach((dist) => {
      const entries = records.cap[dist] ?? [];
      if (entries.length === 0) return;
      series.push({
        label: `CAP ${dist}`,
        data: entries.map((e) => ({ date: e.date, value: e.timeSeconds })),
        formatY: formatTime,
        lowerIsBetter: true,
      });
    });
  }

  if (activeSports.includes("hyrox")) {
    activeHyrox.forEach((id) => {
      const entries = records.hyrox[id] ?? [];
      if (entries.length === 0) return;
      const label = HYROX_CATS.find((c) => c.id === id)?.label ?? id;
      series.push({
        label: `Hyrox ${label}`,
        data: entries.map((e) => ({ date: e.date, value: e.timeSeconds })),
        formatY: formatTime,
        lowerIsBetter: true,
      });
    });
  }

  if (series.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="mb-2 text-3xl">📊</p>
        <p className="text-sm text-dim">Aucun record enregistré.</p>
        <p className="mt-1 text-[13px] text-dim">
          Ajoute des records dans l&apos;onglet &quot;Records&quot; pour voir les tendances.
        </p>
      </div>
    );
  }

  const idx = Math.min(selected, series.length - 1);
  const current = series[idx];

  return (
    <div className="space-y-4">
      {series.length > 1 && (
        <div className="flex rounded-2xl bg-surface2 p-1 overflow-x-auto gap-1">
          {series.map((s, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                i === idx ? "bg-accent text-[#1a1500]" : "text-dim"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
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

  const W = 300, H = 150;
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
              <circle cx={cx} cy={cy} r={9} fill="none" stroke="var(--color-ok)" strokeWidth="1.5" strokeOpacity="0.5" />
            )}
            <circle cx={cx} cy={cy} r={isBest ? 5 : 4} fill={isBest ? "var(--color-ok)" : "var(--color-accent)"} />
            <text x={cx} y={cy - 12} textAnchor="middle" fontSize="9" fontWeight="bold" fill="var(--color-ink)">
              {series.formatY(d.value)}
            </text>
            {d.label2 && (
              <text x={cx} y={cy - 3} textAnchor="middle" fontSize="8" fill="var(--color-dim)">
                {d.label2}
              </text>
            )}
            <text x={cx} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--color-dim)">
              {shortDate(d.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
