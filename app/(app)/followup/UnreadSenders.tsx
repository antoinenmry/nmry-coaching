"use client";

import ChatAvatar from "@/components/ChatAvatar";

export interface UnreadSender {
  id: string;
  name: string;
  photo?: string;
  count: number;
  urgent: number;
}

/**
 * Repère « Nouveaux messages » du coach, sous les onglets de Mon suivi : qui a écrit, combien,
 * urgences en rouge. Un toucher ouvre la conversation. Même source que le compteur de l'onglet.
 */
export default function UnreadSenders({ senders, onOpen }: { senders: UnreadSender[]; onOpen: (id: string) => void }) {
  if (senders.length === 0) return null;
  return (
    <section aria-label="Nouveaux messages" className="rounded-[20px] border border-accent/40 bg-surface p-3">
      <h2 className="mb-2 px-1 text-sm font-black">
        Nouveaux messages <span className="text-dim">· {senders.length} sportif{senders.length > 1 ? "s" : ""}</span>
      </h2>
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {senders.map(s => {
          const first = s.name.split(/\s+/)[0];
          const urgent = s.urgent > 0;
          return (
            <li key={s.id} className="shrink-0">
              <button
                onClick={() => onOpen(s.id)}
                aria-label={`${s.name} : ${s.count} message${s.count > 1 ? "s" : ""} non lu${s.count > 1 ? "s" : ""}${urgent ? ", urgent" : ""}`}
                className="flex w-[68px] flex-col items-center gap-1 rounded-2xl py-1.5 transition active:scale-95"
              >
                <span className={`relative rounded-full p-[2px] ${urgent ? "bg-danger" : "bg-gradient-to-br from-[#ffc53d] to-[#ff9f00]"}`}>
                  <span className="block rounded-full border-2 border-surface">
                    <ChatAvatar name={s.name} photo={s.photo} size={46} />
                  </span>
                  <span
                    className={`absolute -right-1 -top-1 grid h-[22px] min-w-[22px] place-items-center rounded-full border-2 border-surface px-1 text-[11px] font-black ${
                      urgent ? "bg-danger text-white" : "bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] text-[#1a1500]"
                    }`}
                  >
                    {s.count > 9 ? "9+" : s.count}
                  </span>
                </span>
                <span className={`max-w-full truncate text-xs font-bold ${urgent ? "text-danger" : "text-ink"}`}>
                  {urgent ? "Urgent" : first}
                </span>
                {urgent && <span className="-mt-1 max-w-full truncate text-[11px] text-dim">{first}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
