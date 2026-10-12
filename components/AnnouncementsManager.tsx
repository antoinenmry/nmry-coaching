"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "@/components/DataProvider";
import type { Announcement } from "@/lib/types";
import { sportsOf, sportTarget } from "@/lib/sports";
import { AUTO_SLOTS, DEFAULT_INTERVAL_SEC, orderedSlots } from "@/lib/carousel";

const COLORS = ["#ab47bc", "#42a5f5", "#66bb6a", "#ffb300", "#ef5350", "#26c6da"];
const LABEL = "mb-1.5 block text-[10.5px] font-black uppercase tracking-[0.12em] text-dim";
export const todayISO = () => new Date().toISOString().slice(0, 10);
const GOLD = "bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500]";
const todayKey = () => new Date().toISOString().slice(0, 10);

const SPEEDS = [3, 5, 8, 12];

function Ico({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg aria-hidden width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      <path d={d} />
    </svg>
  );
}
const P = {
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  eyeOff: "M3 3l18 18M10.6 5.2A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.5 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.5 0 2.8-.4 4-.9",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  plus: "M12 5v14M5 12h14",
};

/**
 * Menu du carrousel d'accueil (éditeurs) : ordre des pages, pages affichées ou masquées,
 * vitesse et défilement automatique, création / modification / suppression des annonces.
 */
export default function AnnouncementsManager() {
  const { library, updateLibrary } = useData();
  const anns = library.announcements ?? [];
  const cfg = library.carousel ?? {};
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);

  const order = orderedSlots(library);
  const hidden = new Set(cfg.hidden ?? []);
  const annById = new Map(anns.map((a) => [a.id, a]));
  const autoById = new Map(AUTO_SLOTS.map((x) => [x.id, x]));

  const patch = (fn: (c: NonNullable<typeof library.carousel>) => void) =>
    updateLibrary((l) => { const c = (l.carousel ??= {}); fn(c); });

  function move(id: string, dir: -1 | 1) {
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    patch((c) => { c.order = next; });
  }
  function toggle(id: string) {
    patch((c) => {
      const h = new Set(c.hidden ?? []);
      if (h.has(id)) h.delete(id); else h.add(id);
      c.hidden = [...h];
    });
  }

  function save(a: Announcement) {
    updateLibrary((l) => {
      const arr = (l.announcements ??= []);
      const i = arr.findIndex((x) => x.id === a.id);
      if (i === -1) {
        arr.unshift(a);
        // Nouvelle page : juste après les anniversaires du jour, sauf si un ordre est déjà fixé ailleurs.
        const ord = l.carousel?.order;
        if (ord) { const k = ord.indexOf("birthdays"); ord.splice(k + 1, 0, a.id); }
      } else arr[i] = a;
    });
    setEditing(null);
  }
  function remove(id: string) {
    updateLibrary((l) => {
      l.announcements = (l.announcements ?? []).filter((x) => x.id !== id);
      if (l.carousel?.order) l.carousel.order = l.carousel.order.filter((x) => x !== id);
      if (l.carousel?.hidden) l.carousel.hidden = l.carousel.hidden.filter((x) => x !== id);
    });
    setEditing(null);
  }

  const autoOn = cfg.auto !== false;
  const sec = cfg.intervalSec ?? DEFAULT_INTERVAL_SEC;
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-[12px] font-black transition ${on ? "border-transparent " + GOLD : "border-line bg-surface2 text-dim"}`;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="flex-1 font-black">Carrousel de l&apos;accueil</h2>
        <button
          onClick={() => setEditing("new")}
          aria-label="Nouvelle annonce"
          className={`flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-black ${GOLD}`}
        >
          <Ico d={P.plus} className="text-lg" />Page
        </button>
      </div>
      <p className="mb-4 text-[12px] text-dim">
        Les pages défilent en haut de l&apos;accueil de tous les sportifs. Change leur ordre, masque-les ou crée-en de nouvelles.
      </p>

      {/* Défilement */}
      <div className="mb-4 rounded-xl border border-line bg-surface2 p-3">
        <div className="flex items-center gap-3">
          <span className="flex-1">
            <span className="block text-[14px] font-black">Défilement automatique</span>
            <span className="block text-[11.5px] text-dim">Les pages avancent toutes seules</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={autoOn}
            onClick={() => patch((c) => { c.auto = !autoOn; })}
            className={`relative h-[30px] w-[50px] shrink-0 rounded-full border transition ${autoOn ? "border-transparent bg-gradient-to-br from-[#ffc53d] to-[#ff9f00]" : "border-line bg-line/60"}`}
          >
            <span className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-all ${autoOn ? "left-[23px]" : "left-[3px]"}`} />
          </button>
        </div>
        {autoOn && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-black uppercase tracking-[0.12em] text-dim">Vitesse</span>
            {SPEEDS.map((n) => (
              <button key={n} type="button" onClick={() => patch((c) => { c.intervalSec = n; })} className={chip(sec === n)}>{n} s</button>
            ))}
          </div>
        )}
      </div>

      {/* Pages */}
      <span className={LABEL}>Pages · {order.length}</span>
      <div className="space-y-2">
        {order.map((id, i) => {
          const a = annById.get(id);
          const auto = autoById.get(id);
          if (!a && !auto) return null;
          const off = hidden.has(id);
          const expired = !!a?.endDate && a.endDate < todayKey();
          const color = a?.color ?? auto!.color;
          return (
            <div
              key={id}
              className={`relative flex items-center gap-2 overflow-hidden rounded-xl border border-line bg-surface2 py-2 pl-4 pr-2 ${off || expired ? "opacity-55" : ""}`}
            >
              <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-black">{a ? a.title : auto!.label}</span>
                <span className="block truncate text-[11.5px] text-dim">
                  {a
                    ? `${a.poll ? "Sondage" : a.code || a.link ? "Promo ou lien" : "Message"} · ${expired ? "expirée" : a.endDate ? `jusqu'au ${a.endDate.split("-").reverse().slice(0, 2).join("/")}` : "sans fin"}${a.targets?.length ? " · ciblée" : ""}`
                    : `Automatique · ${auto!.desc}`}
                </span>
              </span>
              <span className="flex shrink-0 items-center">
                <button type="button" onClick={() => move(id, -1)} disabled={i === 0} aria-label="Monter" className="grid h-8 w-8 place-items-center rounded-lg text-dim disabled:opacity-25"><Ico d={P.up} className="text-lg" /></button>
                <button type="button" onClick={() => move(id, 1)} disabled={i === order.length - 1} aria-label="Descendre" className="grid h-8 w-8 place-items-center rounded-lg text-dim disabled:opacity-25"><Ico d={P.down} className="text-lg" /></button>
                <button type="button" onClick={() => toggle(id)} aria-label={off ? "Afficher" : "Masquer"} aria-pressed={!off} className={`grid h-8 w-8 place-items-center rounded-lg ${off ? "text-dim" : "text-accent"}`}><Ico d={off ? P.eyeOff : P.eye} className="text-lg" /></button>
                {a && (
                  <button type="button" onClick={() => setEditing(a)} aria-label="Modifier" className="grid h-8 w-8 place-items-center rounded-lg text-dim"><Ico d={P.edit} className="text-base" /></button>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11.5px] text-dim">
        Une page automatique n&apos;apparaît que s&apos;il y a du contenu. L&apos;œil la masque pour tout le monde.
      </p>

      {editing && (
        <AnnouncementForm
          initial={editing === "new" ? null : editing}
          onSave={save}
          onDelete={editing !== "new" ? () => remove(editing.id) : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

type Kind = "message" | "promo" | "poll";
const KINDS: { id: Kind; title: string; desc: string; label: string; color: string }[] = [
  { id: "message", title: "Message", desc: "Une info, un rappel, une bonne nouvelle", label: "Info", color: "#42a5f5" },
  { id: "promo", title: "Promo ou lien", desc: "Un code promo, un lien à ouvrir", label: "Partenaire", color: "#ab47bc" },
  { id: "poll", title: "Sondage", desc: "Une question, 2 à 4 réponses", label: "Sondage", color: "#ffb300" },
];
const DURATIONS: { id: string; label: string; days: number | null }[] = [
  { id: "1", label: "24 h", days: 1 },
  { id: "3", label: "3 jours", days: 3 },
  { id: "7", label: "7 jours", days: 7 },
  { id: "30", label: "30 jours", days: 30 },
  { id: "none", label: "Sans fin", days: null },
];
const inDays = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Assistant de création en 3 pages qui se glissent : 1) type, 2) contenu, 3) destinataires
 * et durée. Une annonce reste affichée jusqu'à sa date de fin ; « Sans fin » = jusqu'à suppression.
 */
export function AnnouncementForm({ initial, onSave, onDelete, onClose }: {
  initial: Announcement | null; onSave: (a: Announcement) => void; onDelete?: () => void; onClose: () => void;
}) {
  const { clients, library } = useData();
  const allSports = sportsOf(library);
  const athletes = clients.filter((c) => c.role === "client");
  const initialKind: Kind = initial?.poll ? "poll" : initial?.code || initial?.link ? "promo" : "message";

  const [step, setStep] = useState(initial ? 1 : 0);
  const [kind, setKind] = useState<Kind>(initialKind);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [options, setOptions] = useState<string[]>(initial?.poll?.options ?? ["Oui", "Non"]);
  const [targets, setTargets] = useState<string[]>(initial?.targets ?? []);
  // Durée : « keep » = garder la date de fin actuelle (édition)
  const [duration, setDuration] = useState<string>(initial ? (initial.endDate ? "keep" : "none") : "7");
  const [color, setColor] = useState(initial?.color ?? KINDS[0].color);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [results, setResults] = useState<{ votes: { name: string; option: string }[]; total: number } | null>(null);

  useEffect(() => {
    if (!initial?.poll) return;
    fetch(`/api/polls/results?id=${encodeURIComponent(initial.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setResults(d))
      .catch(() => {});
  }, [initial]);

  const validOptions = options.map((o) => o.trim()).filter(Boolean);
  const contentOk = !!title.trim() && (kind !== "poll" || validOptions.length >= 2);

  function pickKind(k: Kind) {
    setKind(k);
    setColor(KINDS.find((x) => x.id === k)!.color);
    setStep(1);
  }

  function publish() {
    const d = DURATIONS.find((x) => x.id === duration);
    const endDate = duration === "keep" ? initial?.endDate : d?.days ? inDays(d.days) : undefined;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      label: initial?.label || KINDS.find((x) => x.id === kind)!.label,
      title: title.trim(),
      text: text.trim(),
      code: kind === "promo" ? code.trim() || undefined : undefined,
      link: kind === "promo" ? link.trim() || undefined : undefined,
      poll: kind === "poll" ? { options: validOptions } : undefined,
      color,
      endDate,
      targets: targets.length ? targets : undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
  }

  const titles = ["Que veux-tu publier ?", kind === "poll" ? "Ta question" : "Le contenu", "Pour qui, et combien de temps ?"];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border-t border-line bg-surface sm:rounded-3xl sm:border">
        <div className="flex items-center justify-between px-5 pb-1 pt-5">
          <h2 className="text-lg font-black">{titles[step]}</h2>
          <button onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full bg-surface2">✕</button>
        </div>
        {/* Points de page */}
        <div className="flex gap-1.5 px-5 pb-3 pt-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-accent" : i < step ? "w-3 bg-accent/50" : "w-3 bg-line"}`} />
          ))}
        </div>

        {/* Pages */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full transition-transform duration-300" style={{ transform: `translateX(-${step * 100}%)` }}>
            {/* 1 · Type */}
            <div className="w-full shrink-0 space-y-2.5 overflow-y-auto px-5 pb-5">
              {KINDS.map((k) => (
                <button key={k.id} type="button" onClick={() => pickKind(k.id)}
                  className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-line py-3.5 pl-5 pr-4 text-left"
                  style={{ background: `linear-gradient(120deg, color-mix(in srgb, ${k.color} 26%, var(--color-surface)), var(--color-surface) 75%)` }}>
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: k.color }} />
                  <span className="flex-1">
                    <span className="block text-[16px] font-black">{k.title}</span>
                    <span className="block text-[12.5px] text-dim">{k.desc}</span>
                  </span>
                  <span aria-hidden className="text-lg text-dim">›</span>
                </button>
              ))}
            </div>

            {/* 2 · Contenu (selon le type) */}
            <div className="w-full shrink-0 overflow-y-auto px-5 pb-5">
              <label className="mb-3 block"><span className={LABEL}>{kind === "poll" ? "Question" : "Titre"}</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder={kind === "poll" ? "Dispo pour un stage samedi ?" : kind === "promo" ? "-20 % chez notre partenaire" : "Nouveau programme en ligne"} /></label>
              {kind !== "poll" && (
                <label className="mb-3 block"><span className={LABEL}>Texte (optionnel)</span>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[80px]" /></label>
              )}
              {kind === "promo" && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block"><span className={LABEL}>Code promo</span>
                    <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="NMRY20" /></label>
                  <label className="block"><span className={LABEL}>Lien</span>
                    <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" /></label>
                </div>
              )}
              {kind === "poll" && (
                <div className="space-y-2">
                  <span className={LABEL}>Réponses (2 à 4)</span>
                  {options.map((o, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={o} onChange={(e) => setOptions((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Réponse ${i + 1}`} />
                      {options.length > 2 && (
                        <button type="button" onClick={() => setOptions((arr) => arr.filter((_, j) => j !== i))} aria-label="Retirer" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line text-dim">✕</button>
                      )}
                    </div>
                  ))}
                  {options.length < 4 && (
                    <button type="button" onClick={() => setOptions((arr) => [...arr, ""])} className="text-[12.5px] font-black text-accent">+ Ajouter une réponse</button>
                  )}
                  {results && (
                    <div className="mt-2 rounded-xl border border-line p-3">
                      <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-dim">Résultats · {results.votes.length} / {results.total} réponses</p>
                      {validOptions.map((o) => {
                        const v = results.votes.filter((x) => x.option === o);
                        return <p key={o} className="text-[12.5px]"><b>{o}</b> : {v.length}{v.length > 0 && <span className="text-dim"> ({v.map((x) => x.name.split(" ")[0]).join(", ")})</span>}</p>;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3 · Destinataires + durée */}
            <div className="w-full shrink-0 overflow-y-auto px-5 pb-5">
              <span className={LABEL}>Destinataires · sports puis personnes</span>
              <div className="mb-4 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setTargets([])}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-black ${targets.length === 0 ? "border-transparent " + GOLD : "border-line bg-surface2 text-dim"}`}>Tous</button>
                {allSports.map((sp) => {
                  const t = sportTarget(sp);
                  const on = targets.includes(t);
                  return (
                    <button key={t} type="button" onClick={() => setTargets((x) => (on ? x.filter((y) => y !== t) : [...x, t]))}
                      className={`rounded-full border px-3 py-1.5 text-[12px] font-black ${on ? "border-transparent " + GOLD : "border-line bg-surface2 text-dim"}`}>
                      {sp}
                    </button>
                  );
                })}
                {athletes.map((c) => {
                  const on = targets.includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => setTargets((t) => (on ? t.filter((x) => x !== c.id) : [...t, c.id]))}
                      className={`rounded-full border px-3 py-1.5 text-[12px] font-black ${on ? "border-transparent " + GOLD : "border-line bg-surface2 text-dim"}`}>
                      {(c.name || c.email).split(" ")[0]}
                    </button>
                  );
                })}
              </div>
              <span className={LABEL}>Affichée pendant</span>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {initial?.endDate && (
                  <button type="button" onClick={() => setDuration("keep")}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-black ${duration === "keep" ? "border-transparent " + GOLD : "border-line bg-surface2 text-dim"}`}>
                    Jusqu&apos;au {initial.endDate.split("-").reverse().slice(0, 2).join("/")}
                  </button>
                )}
                {DURATIONS.map((d) => (
                  <button key={d.id} type="button" onClick={() => setDuration(d.id)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-black ${duration === d.id ? "border-transparent " + GOLD : "border-line bg-surface2 text-dim"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="mb-4 text-[12px] text-dim">
                {duration === "none" ? "Reste affichée jusqu'à ce que tu la supprimes." : "Disparaît toute seule à la fin de la durée."} Tu peux publier autant d&apos;annonces que tu veux : elles défilent à tour de rôle.
              </p>
              <span className={LABEL}>Couleur</span>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Couleur ${c}`}
                    className={`h-7 w-7 rounded-full ${color === c ? "shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-ink)]" : ""}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pied : navigation */}
        {step > 0 && (
          <div className="border-t border-line p-4">
            <div className="flex gap-2">
              {(!initial || step > 1) && (
                <button type="button" onClick={() => setStep(step - 1)} className="rounded-full border border-line bg-surface2 px-5 py-3 text-[13px] font-black">Retour</button>
              )}
              {step === 1 ? (
                <button type="button" disabled={!contentOk} onClick={() => setStep(2)} className={`flex-1 rounded-full py-3 font-black disabled:opacity-40 ${GOLD}`}>Suivant</button>
              ) : (
                <button type="button" onClick={publish} className={`flex-1 rounded-full py-3 font-black ${GOLD}`}>{initial ? "Enregistrer" : "Publier"}</button>
              )}
            </div>
            {onDelete && (
              <button type="button" onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
                className={`mt-2 w-full rounded-full border py-2.5 text-[13px] font-black ${confirmDelete ? "border-danger bg-danger text-white" : "border-danger/40 text-danger"}`}>
                {confirmDelete ? "Confirmer la suppression" : "Supprimer l'annonce"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
