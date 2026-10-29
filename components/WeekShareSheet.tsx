"use client";

// Feuille « Partager ma semaine » : aperçu, réglages, puis Copier / Enregistrer / Partager.
// Sans photo, l'image est un PNG transparent (à poser sur sa photo dans Instagram) ;
// avec photo, la photo est intégrée à l'image.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toBlob } from "html-to-image";
import { useData } from "./DataProvider";
import WeekShareCard, { SHARE_LAYOUTS, shareSize, type ShareFormat, type ShareInk, type ShareLayout } from "./WeekShareCard";
import { formatDuration, summarizeWeek } from "@/lib/weekShare";

type Prefs = { layout: ShareLayout; fmt: ShareFormat; ink: ShareInk; shadow: boolean };
const PREFS_KEY = "nmry_share_week_prefs";
const DEFAULT_PREFS: Prefs = { layout: "colonne", fmt: "story", ink: "white", shadow: true };

function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") }; } catch { return DEFAULT_PREFS; }
}

const CHECKER_DARK = "repeating-conic-gradient(#2e3239 0 25%, #23262c 0 50%) 0 0 / 18px 18px";
const CHECKER_LIGHT = "repeating-conic-gradient(#dcdfe5 0 25%, #eceef2 0 50%) 0 0 / 18px 18px";

function Field({ label, extra, children }: { label: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[13px] font-bold text-ink">{label}</p>
        {extra}
      </div>
      {children}
    </div>
  );
}

export default function WeekShareSheet({ monday, onClose }: { monday: Date; onClose: () => void }) {
  const { state, library } = useData();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [photo, setPhoto] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => setPrefs(loadPrefs()), []);
  const setPref = <K extends keyof Prefs>(k: K, v: Prefs[K]) =>
    setPrefs((p) => {
      const next = { ...p, [k]: v };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);

  // Exercices au format allure (min/km) : options de filtre marquées isPace
  const paceExIds = useMemo(() => {
    const opts = new Set<string>();
    library.categories.forEach((c) => c.options.forEach((o) => o.isPace && opts.add(o.id)));
    return new Set(library.exercises.filter((ex) => Object.values(ex.tags).flat().some((t) => opts.has(t))).map((ex) => ex.id));
  }, [library]);

  const summary = useMemo(() => summarizeWeek(state.sessions, monday, paceExIds), [state.sessions, monday, paceExIds]);
  // Par défaut : les 3 exercices aux charges les plus lourdes de la semaine.
  const selected = picked ?? summary.exercises.slice(0, 3).map((e) => e.key);
  const exercises = selected.map((k) => summary.exercises.find((e) => e.key === k)).filter((e): e is NonNullable<typeof e> => !!e);

  const toggleEx = (key: string) => {
    const cur = selected;
    setPicked(cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key].slice(-3));
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 1800); };

  const onPhoto = (file?: File) => {
    if (!file) return;
    if (photo) URL.revokeObjectURL(photo);
    setPhoto(URL.createObjectURL(file));
  };

  async function render(): Promise<Blob | null> {
    const node = exportRef.current?.firstElementChild as HTMLElement | null;
    if (!node) return null;
    await document.fonts.ready;
    const { w, h } = shareSize(prefs.fmt);
    // 1er passage : certains navigateurs (Safari) n'intègrent les images qu'au second rendu.
    await toBlob(node, { width: w, height: h, pixelRatio: 1 }).catch(() => null);
    return toBlob(node, { width: w, height: h, pixelRatio: 1 });
  }

  async function exportAs(action: "copy" | "save" | "share") {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await render();
      if (!blob) throw new Error("render");
      const file = new File([blob], `nmry-semaine-${prefs.layout}.png`, { type: "image/png" });
      const download = () => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        showToast("Image enregistrée");
      };
      if (action === "copy") {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        showToast("Image copiée");
      } else if (action === "share" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Ma semaine NMRY" });
      } else download();
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") showToast("L'image n'a pas pu être créée. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  const canCopy = typeof window !== "undefined" && "ClipboardItem" in window && !!navigator.clipboard?.write;
  const { w, h } = shareSize(prefs.fmt);
  const previewW = prefs.fmt === "story" ? 176 : 210;
  const checker = prefs.ink === "white" ? CHECKER_DARK : CHECKER_LIGHT;
  const cardProps = { summary, exercises, layout: prefs.layout, fmt: prefs.fmt, ink: prefs.ink, shadow: prefs.shadow, photo };

  const scaled = (layout: ShareLayout, width: number) => (
    <div style={{ width, height: Math.round((h * width) / w), position: "relative", overflow: "hidden", background: photo ? undefined : checker }}>
      <div style={{ transform: `scale(${width / w})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
        <WeekShareCard {...cardProps} layout={layout} />
      </div>
    </div>
  );

  const seg = <T extends string | boolean>(value: T, opts: [T, string][], onPick: (v: T) => void) => (
    <div className="grid rounded-[10px] bg-bg p-[3px] ring-1 ring-line" style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0, 1fr))` }}>
      {opts.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onPick(v)}
          aria-pressed={value === v}
          className={`h-8 rounded-[8px] text-[13px] font-bold transition-colors ${value === v ? "bg-surface2 text-ink shadow-[0_1px_2px_rgba(0,0,0,0.3)]" : "text-dim hover:text-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col rounded-t-3xl border-t border-line bg-surface sm:rounded-3xl sm:border">
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-5">
          <div>
            <h2 className="text-lg font-bold">Partager ma semaine</h2>
            <p className="mt-0.5 text-[13px] text-dim">
              {summary.count === 0
                ? "Aucune séance validée cette semaine."
                : `${summary.count} ${summary.count > 1 ? "séances validées" : "séance validée"}, ${summary.estimated ? "≈ " : ""}${formatDuration(summary.minutes)}`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface2">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <div className="mt-2 flex justify-center">
            <div className="overflow-hidden rounded-xl ring-1 ring-line">{scaled(prefs.layout, previewW)}</div>
          </div>

          <Field label="Fond">
            {seg<"none" | "photo">(photo ? "photo" : "none", [["none", "Texte seul"], ["photo", "Avec ma photo"]], (v) => {
              if (v === "none") { if (photo) URL.revokeObjectURL(photo); setPhoto(null); }
              else fileRef.current?.click();
            })}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
            <p className="mt-2 text-[12px] leading-5 text-dim">
              {photo ? (
                <button type="button" onClick={() => fileRef.current?.click()} className="font-bold text-ink underline underline-offset-2">Changer de photo</button>
              ) : (
                "Texte seul : un PNG transparent, à poser sur ta photo dans Instagram ou dans un montage."
              )}
            </p>
          </Field>

          <Field label="Disposition">
            <div className="grid grid-cols-4 gap-2">
              {SHARE_LAYOUTS.map((l) => (
                <button key={l.id} type="button" onClick={() => setPref("layout", l.id)} aria-pressed={prefs.layout === l.id} className="text-center">
                  <span className={`block overflow-hidden rounded-lg transition ${prefs.layout === l.id ? "ring-2 ring-accent" : "ring-1 ring-line"}`}>{scaled(l.id, 74)}</span>
                  <span className={`mt-1.5 block text-[12px] ${prefs.layout === l.id ? "font-bold text-ink" : "text-dim"}`}>{l.name}</span>
                </button>
              ))}
            </div>
          </Field>

          {summary.exercises.length > 0 && (
            <Field label="Exercices" extra={<span className="text-[12px] text-dim">{exercises.length} sur 3</span>}>
              <div className="flex flex-wrap gap-1.5">
                {summary.exercises.map((e) => {
                  const on = selected.includes(e.key);
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => toggleEx(e.key)}
                      aria-pressed={on}
                      className={`h-8 rounded-full px-3 text-[13px] transition-colors ${on ? "bg-ink font-bold text-bg" : "text-ink ring-1 ring-line hover:bg-surface2"}`}
                    >
                      {on && "✓ "}{e.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Format">{seg(prefs.fmt, [["story", "Story 9:16"], ["post", "Post 4:5"]], (v) => setPref("fmt", v))}</Field>
          <Field label="Couleur du texte">{seg(prefs.ink, [["white", "Blanc"], ["black", "Noir"]], (v) => setPref("ink", v))}</Field>
          <Field label="Ombre douce" extra={<span className="text-[12px] text-dim">Lisible sur une photo claire</span>}>
            {seg(prefs.shadow, [[true, "Oui"], [false, "Non"]], (v) => setPref("shadow", v))}
          </Field>
        </div>

        <div className="shrink-0 border-t border-line px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
          <div className={`grid gap-2 ${canCopy ? "grid-cols-[auto_auto_1fr]" : "grid-cols-[auto_1fr]"}`}>
            {canCopy && (
              <button disabled={busy} onClick={() => exportAs("copy")} className="h-11 rounded-xl px-4 text-[14px] font-bold ring-1 ring-line hover:bg-surface2 disabled:opacity-50">Copier</button>
            )}
            <button disabled={busy} onClick={() => exportAs("save")} className="h-11 rounded-xl px-4 text-[14px] font-bold ring-1 ring-line hover:bg-surface2 disabled:opacity-50">Enregistrer</button>
            <button disabled={busy} onClick={() => exportAs("share")} className="h-11 rounded-xl bg-accent text-[14px] font-bold text-[#1a1500] transition active:scale-[0.98] disabled:opacity-50">
              {busy ? "Création…" : "Partager"}
            </button>
          </div>
        </div>

        {toast && (
          <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-ink px-3.5 py-2 text-[13px] font-bold text-bg">{toast}</div>
        )}

        {/* Exemplaire pleine taille, hors écran, servant à l'export */}
        <div ref={exportRef} aria-hidden style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
          <WeekShareCard {...cardProps} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
