"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "@/components/DataProvider";
import type { Announcement } from "@/lib/types";

const COLORS = ["#ab47bc", "#42a5f5", "#66bb6a", "#ffb300", "#ef5350", "#26c6da"];
const LABEL = "mb-1.5 block text-[10.5px] font-black uppercase tracking-[0.12em] text-dim";
export const todayISO = () => new Date().toISOString().slice(0, 10);
const GOLD = "bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500]";
const todayKey = () => new Date().toISOString().slice(0, 10);

/** Gestion des annonces du carrousel d'accueil (coach / admin). */
export default function AnnouncementsManager() {
  const { library, updateLibrary } = useData();
  const list = library.announcements ?? [];
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);

  function save(a: Announcement) {
    updateLibrary((l) => {
      const arr = (l.announcements ??= []);
      const i = arr.findIndex((x) => x.id === a.id);
      if (i === -1) arr.unshift(a); else arr[i] = a;
    });
    setEditing(null);
  }
  function remove(id: string) {
    updateLibrary((l) => { l.announcements = (l.announcements ?? []).filter((x) => x.id !== id); });
    setEditing(null);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="flex-1 font-black">Annonces de l&apos;accueil</h2>
        <button
          onClick={() => setEditing("new")}
          aria-label="Nouvelle annonce"
          className={`grid h-10 w-10 place-items-center rounded-full text-2xl font-black leading-none ${GOLD}`}
        >
          +
        </button>
      </div>
      <p className="mb-3 text-[12px] text-dim">
        Cartes qui défilent toutes les 5 s en haut de l&apos;accueil, pour tous les sportifs.
      </p>
      {list.length === 0 ? (
        <p className="rounded-xl border border-line p-3 text-center text-[13px] text-dim">Aucune annonce.</p>
      ) : (
        <div className="space-y-2">
          {list.map((a) => {
            const expired = !!a.endDate && a.endDate < todayKey();
            return (
              <button
                key={a.id}
                onClick={() => setEditing(a)}
                className={`relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-line bg-surface2 py-2.5 pl-4 pr-3 text-left ${expired ? "opacity-50" : ""}`}
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: a.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-black">{a.title}</span>
                  <span className="block truncate text-[11.5px] text-dim">
                    {expired ? "Expirée" : a.endDate ? `Jusqu'au ${a.endDate.split("-").reverse().join("/")}` : "Sans date de fin"}
                    {a.code ? ` · code ${a.code}` : ""}
                  </span>
                </span>
                <span aria-hidden className="text-dim">›</span>
              </button>
            );
          })}
        </div>
      )}
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
  const { clients } = useData();
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
              <span className={LABEL}>Destinataires</span>
              <div className="mb-4 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setTargets([])}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-black ${targets.length === 0 ? "border-transparent " + GOLD : "border-line bg-surface2 text-dim"}`}>Tous</button>
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
