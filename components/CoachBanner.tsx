"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { AnnouncementForm } from "@/components/AnnouncementsManager";
import type { Announcement } from "@/lib/types";
import { canEditAnnouncements } from "@/lib/config";

const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Bandeau du coach en haut de l'accueil : 2 pages qui se glissent.
 *  1. Vue d'ensemble (photo) → /overview, avec la pastille rouge s'il y a des urgences.
 *  2. Annonces : ajouter / modifier / supprimer les cartes du carrousel des sportifs.
 */
export default function CoachBanner({ urgent }: { urgent: number }) {
  const { library, updateLibrary, me } = useData();
  const canEdit = canEditAnnouncements(me?.email); // gestion des annonces : Simon et Antoine seulement
  const list = library.announcements ?? [];
  const [page, setPage] = useState(0);
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

  const H = "h-[104px] sm:h-[132px]";

  return (
    <div className="relative mb-3.5">
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          setPage(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className={`flex snap-x snap-mandatory overflow-x-auto rounded-[20px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          urgent > 0 ? "ring-2 ring-danger shadow-[0_8px_26px_-10px_rgba(239,83,80,0.8)]" : ""
        }`}
      >
        {/* Page 1 — Vue d'ensemble */}
        <Link
          href="/overview"
          className={`relative isolate flex ${H} w-full shrink-0 snap-center items-center overflow-hidden text-white`}
        >
          <Image
            src="/tiles/overview.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 720px, 100vw"
            className="-z-20 object-cover"
            style={{ objectPosition: "18% 55%" }}
          />
          <span
            aria-hidden
            className={`absolute inset-0 -z-10 ${
              urgent > 0
                ? "bg-[linear-gradient(to_left,rgba(60,6,6,.9)_0%,rgba(60,6,6,.6)_45%,rgba(0,0,0,.05)_80%)]"
                : "bg-[linear-gradient(to_left,rgba(0,0,0,.82)_0%,rgba(0,0,0,.5)_45%,rgba(0,0,0,0)_80%)]"
            }`}
          />
          <span className="ml-auto flex flex-col items-end gap-1 px-4 text-right">
            <span className="text-[22px] font-black uppercase leading-[.95] tracking-[-0.02em] [text-shadow:0_2px_12px_rgba(0,0,0,.45)] sm:text-[28px]">
              Vue d&apos;ensemble
            </span>
            {urgent > 0 ? (
              <span className="flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-0.5 text-[11.5px] font-black">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                {urgent} message{urgent > 1 ? "s" : ""} urgent{urgent > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-[11.5px] font-bold text-white/90">Blessures &amp; objectifs de tous les sportifs ›</span>
            )}
          </span>
        </Link>

        {/* Page 2 — Gestion des annonces */}
        {canEdit && (
        <div
          className={`relative ${H} w-full shrink-0 snap-center overflow-hidden bg-[linear-gradient(120deg,color-mix(in_srgb,var(--color-accent)_18%,var(--color-surface)),var(--color-surface)_70%)] px-4 pb-6 pt-3`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-accent">Annonces</span>
            <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-black/30 px-1 text-[10px] font-black text-dim">{list.length}</span>
            <button
              onClick={() => setEditing("new")}
              aria-label="Nouvelle annonce"
              className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-xl font-black leading-none text-[#1a1500]"
            >
              +
            </button>
          </div>
          {list.length === 0 ? (
            <button onClick={() => setEditing("new")} className="mt-2 text-left text-[12.5px] text-dim">
              Aucune annonce. Touche + pour en publier une (promo, info, lien…).
            </button>
          ) : (
            <div className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none]">
              {list.map((a) => {
                const expired = !!a.endDate && a.endDate < todayKey();
                return (
                  <button
                    key={a.id}
                    onClick={() => setEditing(a)}
                    className={`relative max-w-[200px] shrink-0 overflow-hidden rounded-xl border border-line bg-black/25 py-2 pl-3.5 pr-3 text-left ${expired ? "opacity-50" : ""}`}
                  >
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: a.color }} />
                    <span className="block truncate text-[13px] font-black">{a.title}</span>
                    <span className="block text-[10.5px] text-dim">{expired ? "Expirée" : a.endDate ? `jusqu'au ${a.endDate.split("-").reverse().slice(0, 2).join("/")}` : "sans fin"}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Points de page */}
      {canEdit && <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {[0, 1].map((i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${page === i ? "w-[18px] bg-white" : "w-1.5 bg-white/40"}`} />
        ))}
      </div>}

      {editing && (
        <AnnouncementForm
          initial={editing === "new" ? null : editing}
          onSave={save}
          onDelete={editing !== "new" ? () => remove(editing.id) : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
