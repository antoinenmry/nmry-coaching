"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useData } from "@/components/DataProvider";
import { CHECKIN_QUESTIONS, saveCheckin, localDateKey, type CheckinAnswers, type CheckinKey } from "@/lib/checkin";

const ICON: Record<CheckinKey, string> = {
  sleep: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  energy: "M13 2 4 14h7l-1 8 9-12h-7z",
  pain: "M3 12h4l2-6 4 12 2-6h6",
};
const SCALE_COLOR = ["", "#ef5350", "#ff8a3d", "#ffc53d", "#9ccc4f", "#66bb6a"];

/** Pop-up « Comment tu te sens ? » : 3 notes de 1 à 5, enregistrées dans Mon suivi › Santé › Métriques. */
export default function CheckinSheet({ onClose }: { onClose: () => void }) {
  const { update } = useData();
  const [a, setA] = useState<Partial<CheckinAnswers>>({});
  const answered = CHECKIN_QUESTIONS.filter((q) => a[q.key]).length;
  const ready = answered === CHECKIN_QUESTIONS.length;
  const dateLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  function save() {
    if (!ready) return;
    const answers = a as CheckinAnswers;
    update((d) => { saveCheckin(d, answers, localDateKey()); });
    onClose();
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label="Check-in du jour" className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-[linear-gradient(135deg,#ffc53d,#ff8a00)] px-5 pb-5 pt-5 text-[#1a1500]">
          <button onClick={onClose} aria-label="Fermer" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/15">
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
          <p className="text-[13px] font-bold capitalize opacity-80">{dateLabel}</p>
          <h2 className="mt-1 text-[28px] font-black leading-none tracking-tight">Comment tu te sens ?</h2>
          <div className="mt-3 flex gap-2" aria-hidden>
            {CHECKIN_QUESTIONS.map((q) => (
              <span key={q.key} className={`h-2.5 w-2.5 rounded-full border-2 border-[#1a1500] ${a[q.key] ? "bg-[#1a1500]" : ""}`} />
            ))}
          </div>
        </div>

        <div className="space-y-1 px-5 py-4">
          {CHECKIN_QUESTIONS.map((q, i) => (
            <div key={q.key} className={i > 0 ? "border-t border-line pt-4" : ""} style={{ paddingBottom: 14 }}>
              <div className="mb-2.5 flex items-center gap-2.5">
                <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-dim"><path d={ICON[q.key]} /></svg>
                <span className="text-[16px] font-black">{q.label}</span>
              </div>
              <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={q.label}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const on = a[q.key] === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setA((p) => ({ ...p, [q.key]: n }))}
                      className={`h-12 rounded-2xl text-[17px] font-black transition active:scale-95 ${on ? "text-[#1a1500]" : "bg-surface2 text-dim"}`}
                      style={on ? { background: SCALE_COLOR[n], boxShadow: `0 6px 16px -6px ${SCALE_COLOR[n]}` } : undefined}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between text-[11.5px] font-bold text-dim">
                <span>1 · {q.low}</span>
                <span>5 · {q.high}</span>
              </div>
            </div>
          ))}

          <button
            onClick={save}
            disabled={!ready}
            className="w-full rounded-full bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] py-3.5 text-[15px] font-black text-[#1a1500] transition disabled:opacity-40"
          >
            {ready ? "Enregistrer" : `Encore ${CHECKIN_QUESTIONS.length - answered} réponse${CHECKIN_QUESTIONS.length - answered > 1 ? "s" : ""}`}
          </button>
          <p className="pt-2 text-center text-[11.5px] text-dim">
            Enregistré dans Mon suivi › Santé › Métriques. Désactivable dans Réglages.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
