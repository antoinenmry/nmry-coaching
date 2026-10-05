"use client";

import { useState } from "react";
import { useData } from "@/components/DataProvider";
import { sportsOf } from "@/lib/sports";

/**
 * Liste des sports proposés dans le profil des sportifs (et utilisables pour cibler
 * une annonce ou un message). Réservé aux éditeurs (cf. canEditAnnouncements) :
 * ajout et suppression. Retirer un sport ne touche pas aux profils : ceux qui l'avaient
 * choisi le gardent et peuvent le décocher.
 */
export default function SportsManager() {
  const { library, updateLibrary } = useData();
  const sports = sportsOf(library);
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const add = () => {
    const v = name.trim().slice(0, 40);
    if (!v || sports.some((s) => s.toLowerCase() === v.toLowerCase())) { setName(""); return; }
    updateLibrary((l) => { l.sports = [...sportsOf(l), v]; });
    setName("");
  };
  const remove = (s: string) => {
    updateLibrary((l) => { l.sports = sportsOf(l).filter((x) => x !== s); });
    setPendingDelete(null);
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-1 font-bold">Sports du profil</h2>
      <p className="mb-3 text-[12px] text-dim">
        Les sportifs choisissent leurs sports parmi cette liste. Tu peux aussi envoyer un message ou une annonce à un seul sport.
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {sports.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface2 py-1 pl-3 pr-1 text-[12.5px] font-black">
            {s}
            {pendingDelete === s ? (
              <button onClick={() => remove(s)} className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-black text-white">Supprimer ?</button>
            ) : (
              <button onClick={() => setPendingDelete(s)} aria-label={`Retirer ${s}`} className="grid h-6 w-6 place-items-center rounded-full text-dim hover:text-danger">
                <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Nouveau sport (ex. Natation)"
          maxLength={40}
          className="min-w-0 flex-1"
        />
        <button
          onClick={add}
          disabled={!name.trim()}
          className="shrink-0 rounded-xl bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] px-4 font-black text-[#1a1500] disabled:opacity-40"
        >
          Ajouter
        </button>
      </div>
    </section>
  );
}
