"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
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
const SPORT_META: { id: SportId; label: string }[] = [
  { id: "strength", label: "Musculation" },
  { id: "cap", label: "Course à pied" },
  { id: "hyrox", label: "Hyrox" },
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
  // Fix 1 : utiliser `library` (bibliothèque partagée library_state)
  // et non `state.library` (blob JSON per-user, ignoré en mode auth)
  const { state, update, library } = useData();
  const [tab, setTab] = useState<"records" | "tendances">("records");

  const records: RecordsData = state.records ?? emptyRecords();
  const patch = (fn: (r: RecordsData) => void) =>
    update((d) => { d.records ??= emptyRecords(); fn(d.records); });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-full border border-line bg-surface p-1">
        {(["records", "tendances"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full py-2.5 text-[13px] font-black transition ${
              tab === t ? "bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500] shadow-[0_6px_18px_-6px_rgba(255,170,0,0.7)]" : "text-dim"
            }`}
          >
            {t === "records" ? "Records" : "Tendances"}
          </button>
        ))}
      </div>

      {tab === "records" ? (
        <RecordsTab records={records} patch={patch} library={library} />
      ) : (
        <TendancesTab records={records} library={library} />
      )}
    </div>
  );
}

// ─── Onglet Records ───────────────────────────────────────────────────────────
// Liste compacte par sport (même esthétique que /plan et /goals) : une ligne par
// exercice / distance / catégorie avec seulement le meilleur record ; l'historique,
// l'édition et l'ajout s'ouvrent au tap. Un seul bouton « + » en haut.
type AnyEntry = StrengthRecord | CardioRecord;
type Item = { key: string; name: string; entries: AnyEntry[] };
type Target = { sport: SportId; key: string };

const isStrength = (e: AnyEntry): e is StrengthRecord => "weight" in e;

function capLabel(d: CapDistance): string {
  return d === "21km" ? "Semi-marathon" : d === "42km" ? "Marathon" : d.replace("km", " km");
}

function fullDate(key: string): string {
  const months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

// Meilleur record + écart avec le 2ᵉ (poids max en muscu, temps min en cardio).
function bestOf(entries: AnyEntry[]): { best: AnyEntry | null; delta: string } {
  if (entries.length === 0) return { best: null, delta: "" };
  if (isStrength(entries[0])) {
    const s = [...(entries as StrengthRecord[])].sort((a, b) => b.weight - a.weight || b.reps - a.reps);
    const d = s[1] ? Math.round((s[0].weight - s[1].weight) * 10) / 10 : 0;
    return { best: s[0], delta: d > 0 ? `+${d} kg` : "" };
  }
  const c = [...(entries as CardioRecord[])].sort((a, b) => a.timeSeconds - b.timeSeconds);
  const d = c[1] ? c[1].timeSeconds - c[0].timeSeconds : 0;
  return { best: c[0], delta: d > 0 ? `−${formatTime(d)}` : "" };
}

function entryValue(e: AnyEntry): { main: string; unit: string } {
  return isStrength(e) ? { main: String(e.weight), unit: `kg × ${e.reps}` } : { main: formatTime(e.timeSeconds), unit: "" };
}

const SPORT_STYLE: Record<SportId, { label: string; color: string }> = {
  strength: { label: "Musculation", color: "var(--color-accent)" },
  cap: { label: "Course à pied", color: "var(--color-accent2)" },
  hyrox: { label: "Hyrox", color: "#ab47bc" },
};
const ROWS_PREVIEW = 5;
const GOLD = "bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500]";

// Les pop-ups sont rendues dans <body> : sinon un parent avec effet de flou (thème Aurora)
// les enferme dans sa carte et la section suivante passe par-dessus.
function Portal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">{title}</h2>
            <button onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full bg-surface2">✕</button>
          </div>
          {children}
        </div>
      </div>
    </Portal>
  );
}

function RecordsTab({
  records,
  patch,
  library,
}: {
  records: RecordsData;
  patch: (fn: (r: RecordsData) => void) => void;
  library: ExerciseLibrary;
}) {
  const activeSports = getActiveSports(records);
  const [addOpen, setAddOpen] = useState(false);
  const [picker, setPicker] = useState<SportId | "sport" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<SportId | null>(null);
  const [open, setOpen] = useState<Target | null>(null);
  // Formulaire affiché dans la ligne ouverte : ajout, édition d'une entrée, renommage.
  const [form, setForm] = useState<{ kind: "add" } | { kind: "edit"; id: string } | { kind: "rename" } | null>(null);
  const [collapsed, setCollapsed] = useState<SportId[]>([]);
  const [expanded, setExpanded] = useState<SportId[]>([]);
  const [query, setQuery] = useState("");

  const exName = (exId: string, saved?: string) =>
    saved || library.exercises.find((e) => e.id === exId)?.name || exId;

  const itemsOf = (sport: SportId): Item[] => {
    if (sport === "strength")
      return records.strength.filter((r) => r.visible).map((r) => ({ key: r.exId, name: exName(r.exId, r.name), entries: r.entries ?? [] }));
    if (sport === "cap")
      return getActiveCap(records).map((d) => ({ key: d, name: capLabel(d), entries: records.cap[d] ?? [] }));
    return getActiveHyrox(records).map((c) => ({
      key: c,
      name: HYROX_CATS.find((x) => x.id === c)?.label ?? c,
      entries: records.hyrox[c] ?? [],
    }));
  };

  // Accès en écriture à la liste d'entrées d'une ligne (dans le brouillon immer).
  const entriesIn = (r: RecordsData, t: Target): AnyEntry[] | undefined => {
    if (t.sport === "strength") return r.strength.find((x) => x.exId === t.key)?.entries;
    if (t.sport === "cap") return (r.cap[t.key as CapDistance] ??= []);
    return (r.hyrox[t.key as HyroxCategory] ??= []);
  };

  const addEntry = (t: Target, e: Omit<StrengthRecord, "id"> | Omit<CardioRecord, "id">) =>
    patch((r) => {
      const list = entriesIn(r, t);
      if (list && list.length < MAX) list.push({ ...e, id: uid() } as AnyEntry);
    });
  const editEntry = (t: Target, id: string, e: Omit<StrengthRecord, "id"> | Omit<CardioRecord, "id">) =>
    patch((r) => {
      const list = entriesIn(r, t);
      const i = list?.findIndex((x) => x.id === id) ?? -1;
      if (list && i !== -1) list[i] = { ...e, id } as AnyEntry;
    });
  const removeEntry = (t: Target, id: string) =>
    patch((r) => {
      const list = entriesIn(r, t);
      if (!list) return;
      const i = list.findIndex((x) => x.id === id);
      if (i !== -1) list.splice(i, 1);
    });
  const hideItem = (t: Target) => {
    patch((r) => {
      if (t.sport === "strength") {
        const ex = r.strength.find((x) => x.exId === t.key);
        if (ex) ex.visible = false;
      } else if (t.sport === "cap") r.activeCap = getActiveCap(r).filter((d) => d !== t.key);
      else r.activeHyrox = getActiveHyrox(r).filter((c) => c !== t.key);
    });
    setOpen(null);
  };
  const rename = (exId: string, name: string) =>
    patch((r) => {
      const ex = r.strength.find((x) => x.exId === exId);
      if (ex && name.trim()) ex.name = name.trim();
    });

  // Ajout d'une ligne puis ouverture directe de son formulaire d'ajout.
  const openAdd = (t: Target) => { setOpen(t); setForm({ kind: "add" }); setCollapsed((c) => c.filter((s) => s !== t.sport)); };
  const addItem = (sport: SportId, key: string, name?: string) => {
    patch((r) => {
      if (!getActiveSports(r).includes(sport)) r.activeSports = [...getActiveSports(r), sport];
      if (sport === "strength") {
        const ex = r.strength.find((x) => x.exId === key);
        if (ex) ex.visible = true;
        else r.strength.push({ exId: key, name: name ?? key, visible: true, entries: [] });
      } else if (sport === "cap") {
        if (!getActiveCap(r).includes(key as CapDistance)) r.activeCap = [...getActiveCap(r), key as CapDistance];
      } else if (!getActiveHyrox(r).includes(key as HyroxCategory)) {
        r.activeHyrox = [...getActiveHyrox(r), key as HyroxCategory];
      }
    });
    setPicker(null);
    openAdd({ sport, key });
  };

  const q = query.trim().toLowerCase();
  const totalItems = activeSports.reduce((n, s) => n + itemsOf(s).length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-xl font-black">Mes records</h2>
        <button
          onClick={() => setAddOpen(true)}
          aria-label="Ajouter"
          className={`grid h-11 w-11 place-items-center rounded-full text-2xl font-black leading-none shadow-[0_6px_18px_-6px_rgba(255,170,0,0.7)] transition active:scale-95 ${GOLD}`}
        >
          +
        </button>
      </div>

      {totalItems > 6 && (
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un exercice…" />
      )}

      {activeSports.length === 0 && (
        <button
          onClick={() => setAddOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-line p-4 text-left text-[13px] leading-snug text-dim"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface2 text-lg font-black text-accent">+</span>
          Aucun record. Ajoute un sport pour commencer à suivre tes perfs.
        </button>
      )}

      {SPORT_META.filter(({ id }) => activeSports.includes(id)).map(({ id: sport }) => {
        const style = SPORT_STYLE[sport];
        const all = itemsOf(sport);
        const items = q ? all.filter((it) => it.name.toLowerCase().includes(q)) : all;
        if (q && items.length === 0) return null;
        const isCollapsed = collapsed.includes(sport) && !q;
        const showAll = expanded.includes(sport) || !!q;
        const shown = showAll ? items : items.slice(0, ROWS_PREVIEW);
        return (
          <section key={sport}>
            <div className="mb-2 mt-4 flex items-center gap-2 px-0.5">
              <button
                onClick={() => setCollapsed((c) => (c.includes(sport) ? c.filter((s) => s !== sport) : [...c, sport]))}
                aria-expanded={!isCollapsed}
                className="flex flex-1 items-center gap-2 text-left text-[11px] font-black uppercase tracking-[0.12em]"
                style={{ color: style.color }}
              >
                {style.label}
                <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-surface2 px-1 text-[10px] tracking-normal text-dim">
                  {all.length}
                </span>
                <span aria-hidden className="text-[12px] text-dim">{isCollapsed ? "▸" : "▾"}</span>
              </button>
              <button
                onClick={() => setConfirmRemove(sport)}
                className="rounded-full px-2 py-0.5 text-[11px] font-bold text-dim hover:text-danger"
              >
                Retirer
              </button>
            </div>

            {!isCollapsed && (
              items.length === 0 ? (
                <button
                  onClick={() => setPicker(sport)}
                  className="w-full rounded-2xl border-[1.5px] border-dashed border-line p-3 text-center text-[13px] font-bold text-dim"
                >
                  + Ajouter {sport === "strength" ? "un exercice" : sport === "cap" ? "une distance" : "une catégorie"}
                </button>
              ) : (
                <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
                  {shown.map((it, i) => {
                    const t = { sport, key: it.key };
                    const isOpen = open?.sport === sport && open.key === it.key;
                    const { best, delta } = bestOf(it.entries);
                    const val = best ? entryValue(best) : null;
                    return (
                      <div key={it.key} className={i > 0 ? "border-t border-line/70" : ""}>
                        <button
                          onClick={() => { setOpen(isOpen ? null : t); setForm(null); }}
                          aria-expanded={isOpen}
                          className="grid w-full grid-cols-[4px_minmax(0,1fr)_auto_12px] items-center gap-3 px-3 py-3 text-left"
                          style={isOpen ? { background: `color-mix(in srgb, ${style.color} 8%, transparent)` } : undefined}
                        >
                          <span aria-hidden className="min-h-[30px] self-stretch rounded" style={{ background: style.color }} />
                          <span className="min-w-0">
                            <span className="block truncate text-[15px] font-black">{it.name}</span>
                            <span className="block text-[11.5px] text-dim">{best ? fullDate(best.date) : "Aucune perf"}</span>
                          </span>
                          <span className="text-right leading-tight">
                            {val ? (
                              <span className="block whitespace-nowrap text-[17px] font-black">
                                {val.main}
                                {val.unit && <span className="ml-1 text-[11px] font-bold text-dim">{val.unit}</span>}
                              </span>
                            ) : (
                              <span className="text-[15px] font-black text-dim">—</span>
                            )}
                            {delta && <span className="block text-[10.5px] font-black text-ok">{delta}</span>}
                          </span>
                          <span aria-hidden className={`text-dim transition ${isOpen ? "rotate-90" : ""}`}>›</span>
                        </button>

                        {isOpen && (
                          <RecordDetail
                            item={it}
                            sport={sport}
                            color={style.color}
                            form={form}
                            setForm={setForm}
                            onAdd={(e) => { addEntry(t, e); setForm(null); }}
                            onEdit={(id, e) => { editEntry(t, id, e); setForm(null); }}
                            onRemoveEntry={(id) => removeEntry(t, id)}
                            onRename={(name) => { rename(it.key, name); setForm(null); }}
                            onHide={() => hideItem(t)}
                          />
                        )}
                      </div>
                    );
                  })}
                  {!showAll && items.length > ROWS_PREVIEW && (
                    <button
                      onClick={() => setExpanded((e) => [...e, sport])}
                      className="w-full border-t border-line/70 py-2.5 text-center text-[12px] font-black text-dim"
                    >
                      Voir les {items.length - ROWS_PREVIEW} autres ▾
                    </button>
                  )}
                </div>
              )
            )}
          </section>
        );
      })}

      {/* Pop-up « + » : ajouter dans un sport actif ou activer un nouveau sport */}
      {addOpen && (
        <Sheet title="Ajouter" onClose={() => setAddOpen(false)}>
          <div className="space-y-2">
            {SPORT_META.filter(({ id }) => activeSports.includes(id)).map(({ id }) => (
              <button
                key={id}
                onClick={() => { setAddOpen(false); setPicker(id); }}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface2 p-3.5 text-left text-[14px] font-black"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SPORT_STYLE[id].color }} />
                <span className="flex-1">
                  {id === "strength" ? "Un record en musculation" : id === "cap" ? "Un temps en course à pied" : "Un temps Hyrox"}
                </span>
                <span className="text-dim">›</span>
              </button>
            ))}
            {activeSports.length < SPORT_META.length && (
              <button
                onClick={() => { setAddOpen(false); setPicker("sport"); }}
                className="flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-line p-3.5 text-left text-[14px] font-black text-dim"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-dim" />
                <span className="flex-1">Un nouveau sport</span>
                <span>›</span>
              </button>
            )}
          </div>
        </Sheet>
      )}

      {picker === "sport" && (
        <Sheet title="Ajouter un sport" onClose={() => setPicker(null)}>
          <div className="space-y-2">
            {SPORT_META.filter(({ id }) => !activeSports.includes(id)).map(({ id }) => (
              <button
                key={id}
                onClick={() => { patch((r) => { r.activeSports = [...getActiveSports(r), id]; }); setPicker(id); }}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface2 p-3.5 text-left text-[14px] font-black"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SPORT_STYLE[id].color }} />
                <span className="flex-1">{SPORT_STYLE[id].label}</span>
                <span className="text-dim">›</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {picker === "strength" && (
        <ExercisePickerModal
          library={library}
          addedIds={records.strength.filter((r) => r.visible).map((r) => r.exId)}
          onAdd={(exId, name) => addItem("strength", exId, name)}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === "cap" && (
        <Sheet title="Ajouter une distance" onClose={() => setPicker(null)}>
          <div className="grid grid-cols-2 gap-2">
            {CAP_DISTANCES.map((d) => {
              const already = getActiveCap(records).includes(d);
              return (
                <button
                  key={d}
                  onClick={() => (already ? (setPicker(null), openAdd({ sport: "cap", key: d })) : addItem("cap", d))}
                  className="rounded-2xl border border-line bg-surface2 px-3 py-3 text-[14px] font-black"
                >
                  {capLabel(d)}
                  {already && <span className="block text-[11px] font-bold text-dim">déjà suivie</span>}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
      {picker === "hyrox" && (
        <Sheet title="Ajouter une catégorie" onClose={() => setPicker(null)}>
          <div className="grid grid-cols-2 gap-2">
            {HYROX_CATS.map(({ id, label }) => {
              const already = getActiveHyrox(records).includes(id);
              return (
                <button
                  key={id}
                  onClick={() => (already ? (setPicker(null), openAdd({ sport: "hyrox", key: id })) : addItem("hyrox", id))}
                  className="rounded-2xl border border-line bg-surface2 px-3 py-3 text-[14px] font-black"
                >
                  {label}
                  {already && <span className="block text-[11px] font-bold text-dim">déjà suivie</span>}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}

      {confirmRemove && (
        <ConfirmRemoveModal
          label={SPORT_STYLE[confirmRemove].label}
          onConfirm={() => {
            patch((r) => { r.activeSports = getActiveSports(r).filter((s) => s !== confirmRemove); });
            setConfirmRemove(null);
          }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}

// ─── Détail d'une ligne : historique + actions ────────────────────────────────
function RecordDetail({
  item,
  sport,
  color,
  form,
  setForm,
  onAdd,
  onEdit,
  onRemoveEntry,
  onRename,
  onHide,
}: {
  item: Item;
  sport: SportId;
  color: string;
  form: { kind: "add" } | { kind: "edit"; id: string } | { kind: "rename" } | null;
  setForm: (f: { kind: "add" } | { kind: "edit"; id: string } | { kind: "rename" } | null) => void;
  onAdd: (e: Omit<StrengthRecord, "id"> | Omit<CardioRecord, "id">) => void;
  onEdit: (id: string, e: Omit<StrengthRecord, "id"> | Omit<CardioRecord, "id">) => void;
  onRemoveEntry: (id: string) => void;
  onRename: (name: string) => void;
  onHide: () => void;
}) {
  const [renameValue, setRenameValue] = useState(item.name);
  const showHours = sport === "hyrox" || item.key === "21km" || item.key === "42km";
  const sorted = [...item.entries].sort((a, b) => b.date.localeCompare(a.date));
  const { best } = bestOf(item.entries);

  return (
    <div className="border-t border-line/70 px-3.5 pb-3.5 pt-2" style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }}>
      {sorted.length > 0 && (
        <div className="mb-2.5 divide-y divide-line/50">
          {sorted.map((e) => {
            if (form?.kind === "edit" && form.id === e.id) {
              return (
                <div key={e.id} className="py-2">
                  {isStrength(e) ? (
                    <EditStrengthForm initial={e} onSave={(u) => onEdit(e.id, u)} onCancel={() => setForm(null)} />
                  ) : (
                    <EditCardioForm initial={e} showHours={showHours} onSave={(u) => onEdit(e.id, u)} onCancel={() => setForm(null)} />
                  )}
                </div>
              );
            }
            const v = entryValue(e);
            return (
              <div key={e.id} className="flex items-center gap-2 py-2 text-[13px]">
                <span className="flex-1 text-dim">{fullDate(e.date)}</span>
                {best?.id === e.id && (
                  <span className="rounded-full bg-ok/15 px-1.5 py-px text-[10px] font-black text-ok">RECORD</span>
                )}
                <span className="font-black">{v.main}{v.unit && ` ${v.unit}`}</span>
                <button onClick={() => setForm({ kind: "edit", id: e.id })} aria-label="Modifier" className="grid h-7 w-7 place-items-center rounded-full text-dim hover:text-ink">
                  <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
                </button>
                <button onClick={() => onRemoveEntry(e.id)} aria-label="Supprimer" className="grid h-7 w-7 place-items-center rounded-full text-dim hover:text-danger">✕</button>
              </div>
            );
          })}
        </div>
      )}

      {form?.kind === "add" && (
        sport === "strength"
          ? <AddStrengthForm onAdd={onAdd} onCancel={() => setForm(null)} />
          : <AddCardioForm showHours={showHours} onAdd={onAdd} onCancel={() => setForm(null)} />
      )}

      {form?.kind === "rename" && (
        <div className="mb-2 flex gap-2">
          <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onRename(renameValue)} className="flex-1" />
          <button onClick={() => onRename(renameValue)} className={`rounded-full px-4 text-[13px] font-black ${GOLD}`}>OK</button>
        </div>
      )}

      {form === null && (
        <div className="flex gap-1.5">
          {sport === "strength" && (
            <button onClick={() => setForm({ kind: "rename" })} className="rounded-full border border-line bg-surface2 px-3 py-2 text-[12px] font-black">
              Renommer
            </button>
          )}
          <button onClick={onHide} className="rounded-full border border-danger/40 px-3 py-2 text-[12px] font-black text-danger">
            Retirer
          </button>
          {item.entries.length < MAX ? (
            <button onClick={() => setForm({ kind: "add" })} className={`flex-1 rounded-full py-2 text-[12.5px] font-black ${GOLD}`}>
              + Nouvelle perf
            </button>
          ) : (
            <span className="flex-1 self-center text-right text-[11px] text-dim">{MAX} perfs max · modifie ou supprime-en une</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modale : choisir exercice ─────────────────────────────────────────────────
// Affiche library.exercises (bibliothèque partagée, pas state.library)
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
  const [search, setSearch] = useState("");
  const submit = () => {
    if (customName.trim()) { onAdd(uid(), customName.trim()); setCustomName(""); }
  };
  const list = library.exercises.filter((ex) => ex.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Sheet title="Ajouter un exercice" onClose={onClose}>
      {library.exercises.length > 0 && (
        <>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="mb-2" />
          <div className="mb-4 max-h-[42vh] space-y-1.5 overflow-y-auto">
            {list.map((ex) => {
              const already = addedIds.includes(ex.id);
              return (
                <button
                  key={ex.id}
                  onClick={() => !already && onAdd(ex.id, ex.name)}
                  disabled={already}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition ${
                    already ? "cursor-not-allowed border-line bg-surface2 text-dim opacity-50" : "border-line bg-surface2 hover:border-accent"
                  }`}
                >
                  <span>{ex.name}</span>
                  {already && <span className="text-xs font-normal text-dim">Déjà suivi</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      <span className="mb-1.5 block text-[10.5px] font-black uppercase tracking-[0.12em] text-dim">Exercice personnalisé</span>
      <div className="flex gap-2">
        <input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Nom de l'exercice…"
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button onClick={submit} disabled={!customName.trim()} className={`rounded-full px-4 text-sm font-black disabled:opacity-40 ${GOLD}`}>
          Ajouter
        </button>
      </div>
    </Sheet>
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
    <Sheet title={`Retirer ${label} ?`} onClose={onCancel}>
      <p className="mb-5 text-sm text-dim">La section sera masquée. Les records enregistrés sont conservés.</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 rounded-full border border-line py-3 text-sm font-black">Annuler</button>
        <button onClick={onConfirm} className="flex-1 rounded-full bg-danger py-3 text-sm font-black text-white">Retirer</button>
      </div>
    </Sheet>
  );
}

// ─── Formulaire musculation — ajout ───────────────────────────────────────────
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

// ─── Fix 2 : Formulaire musculation — édition ─────────────────────────────────
function EditStrengthForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: StrengthRecord;
  onSave: (e: Omit<StrengthRecord, "id">) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(initial.date);
  const [weight, setWeight] = useState(String(initial.weight));
  const [reps, setReps] = useState(String(initial.reps));

  return (
    <div className="space-y-2 rounded-lg border border-accent/30 bg-surface p-3">
      <label className="block">
        <span className="mb-1 block text-[12px] text-dim">Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[12px] text-dim">Poids (kg)</span>
          <input type="number" min={0} step={0.5} value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-dim">Répétitions</span>
          <input type="number" min={1} value={reps} onChange={(e) => setReps(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ date, weight: parseFloat(weight) || 0, reps: parseInt(reps) || 1 })}
          disabled={!weight || parseFloat(weight) <= 0}
          className="flex-1 rounded-lg bg-ok/90 py-2 text-sm font-semibold text-[#06210a] disabled:opacity-40"
        >
          Enregistrer
        </button>
        <button onClick={onCancel} className="rounded-lg bg-surface2 px-3 py-2 text-sm text-dim">
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Formulaire cardio — ajout ────────────────────────────────────────────────
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

// ─── Fix 2 : Formulaire cardio — édition ──────────────────────────────────────
function EditCardioForm({
  initial,
  showHours,
  onSave,
  onCancel,
}: {
  initial: CardioRecord;
  showHours: boolean;
  onSave: (e: Omit<CardioRecord, "id">) => void;
  onCancel: () => void;
}) {
  const h0 = Math.floor(initial.timeSeconds / 3600);
  const m0 = Math.floor((initial.timeSeconds % 3600) / 60);
  const s0 = initial.timeSeconds % 60;
  const [date, setDate] = useState(initial.date);
  const [hours, setHours] = useState(String(h0));
  const [minutes, setMinutes] = useState(String(m0));
  const [seconds, setSeconds] = useState(String(s0));

  const total =
    (parseInt(hours) || 0) * 3600 +
    (parseInt(minutes) || 0) * 60 +
    (parseInt(seconds) || 0);

  return (
    <div className="space-y-2 rounded-lg border border-accent/30 bg-surface p-3">
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
          onClick={() => onSave({ date, timeSeconds: total })}
          disabled={total === 0}
          className="flex-1 rounded-lg bg-ok/90 py-2 text-sm font-semibold text-[#06210a] disabled:opacity-40"
        >
          Enregistrer
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
        // Fix 1 + 3 : priorité au nom sauvegardé (inclut les renommages)
        const name = r.name || library.exercises.find((e) => e.id === r.exId)?.name || r.exId;
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
