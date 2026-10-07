"use client";

import { useState } from "react";

type Lang = "fr" | "en" | "pt";
const LANGS: { id: Lang; label: string }[] = [
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
  { id: "pt", label: "Português" },
];

type Entry = {
  id: string;
  q: Record<Lang, string>;
  lines: Record<Lang, string[]>;
};

/** Questions fréquentes : ajouter une entrée ici suffit à la faire apparaître. */
const ENTRIES: Entry[] = [
  {
    id: "rpe",
    q: { fr: "C'est quoi le RPE ?", en: "What is RPE?", pt: "O que é o RPE?" },
    lines: {
      fr: [
        "Une note de 1 à 10 pour dire à quel point ta série était dure.",
        "Demande-toi : « Combien de reps aurais-je encore pu faire ? »",
        "0 rep = RPE10 · 1 rep = RPE9 · 2 reps = RPE8 · 3 reps = RPE7 · 4 reps ou + = RPE6 ou moins",
        "En cas de doute, choisis un poids un peu plus léger.",
      ],
      en: [
        "A score from 1 to 10 for how hard your set felt.",
        "Ask yourself: \"How many more reps could I have done?\"",
        "0 reps = RPE10 · 1 rep = RPE9 · 2 reps = RPE8 · 3 reps = RPE7 · 4 or more reps = RPE6 or lower",
        "When in doubt, pick a slightly lighter weight.",
      ],
      pt: [
        "Uma nota de 1 a 10 para dizer quão difícil foi a tua série.",
        "Pergunta-te: \"Quantas repetições ainda conseguiria ter feito?\"",
        "0 repetições = RPE10 · 1 repetição = RPE9 · 2 repetições = RPE8 · 3 repetições = RPE7 · 4 ou mais repetições = RPE6 ou menos",
        "Em caso de dúvida, escolhe um peso um pouco mais leve.",
      ],
    },
  },
];

export default function Faq() {
  const [lang, setLang] = useState<Lang>("fr");
  const [open, setOpen] = useState<string | null>("rpe");

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-full border border-line bg-surface p-1" role="group" aria-label="Langue">
        {LANGS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLang(l.id)}
            aria-pressed={lang === l.id}
            className={`rounded-full py-2 text-[12.5px] font-black transition ${
              lang === l.id ? "bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500]" : "text-dim"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {ENTRIES.map((e) => {
          const isOpen = open === e.id;
          return (
            <div key={e.id} className="overflow-hidden rounded-2xl border border-line bg-[linear-gradient(160deg,color-mix(in_srgb,var(--color-accent)_9%,var(--color-surface2)),var(--color-surface2)_70%)]">
              <button
                onClick={() => setOpen(isOpen ? null : e.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <span className="text-[15px] font-black">{e.q[lang]}</span>
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-dim transition ${isOpen ? "rotate-180" : ""}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-line px-4 pb-4 pt-3 text-[13.5px] leading-relaxed text-dim">
                  {e.lines[lang].map((t, i) => (
                    <p key={i} className={i === 0 ? "font-bold text-ink" : ""}>{t}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
