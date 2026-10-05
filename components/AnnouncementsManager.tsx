"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "@/components/DataProvider";
import type { Announcement } from "@/lib/types";

const COLORS = ["#ab47bc", "#42a5f5", "#66bb6a", "#ffb300", "#ef5350", "#26c6da"];
const LABEL = "mb-1.5 block text-[10.5px] font-black uppercase tracking-[0.12em] text-dim";
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

function AnnouncementForm({ initial, onSave, onDelete, onClose }: {
  initial: Announcement | null; onSave: (a: Announcement) => void; onDelete?: () => void; onClose: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 sm:rounded-3xl sm:border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">{initial ? "Modifier l'annonce" : "Nouvelle annonce"}</h2>
          <button onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full bg-surface2">✕</button>
        </div>
        <label className="mb-3 block"><span className={LABEL}>Étiquette (optionnel)</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Partenaire, Info, Rappel…" /></label>
        <label className="mb-3 block"><span className={LABEL}>Titre</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="-20 % chez notre partenaire" autoFocus /></label>
        <label className="mb-3 block"><span className={LABEL}>Texte (optionnel)</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[70px]" /></label>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block"><span className={LABEL}>Code promo</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="NMRY20" /></label>
          <label className="block"><span className={LABEL}>Lien</span>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" /></label>
        </div>
        <label className="mb-3 block"><span className={LABEL}>Affichée jusqu&apos;au (optionnel)</span>
          <input type="date" value={endDate} min={todayKey()} onChange={(e) => setEndDate(e.target.value)} /></label>
        <span className={LABEL}>Couleur</span>
        <div className="mb-4 flex gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Couleur ${c}`}
              className={`h-7 w-7 rounded-full ${color === c ? "shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-ink)]" : ""}`}
              style={{ background: c }} />
          ))}
        </div>
        <button
          disabled={!title.trim()}
          onClick={() => onSave({
            id: initial?.id ?? crypto.randomUUID(),
            label: label.trim(), title: title.trim(), text: text.trim(),
            code: code.trim() || undefined, link: link.trim() || undefined,
            color, endDate: endDate || undefined, createdAt: initial?.createdAt ?? new Date().toISOString(),
          })}
          className={`w-full rounded-full py-3 font-black disabled:opacity-40 ${GOLD}`}
        >
          {initial ? "Enregistrer" : "Publier"}
        </button>
        {onDelete && (
          <button
            onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            className={`mt-2 w-full rounded-full border py-2.5 text-[13px] font-black ${confirmDelete ? "border-danger bg-danger text-white" : "border-danger/40 text-danger"}`}
          >
            {confirmDelete ? "Confirmer la suppression" : "Supprimer"}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
