"use client";

import ChatAvatar from "@/components/ChatAvatar";

export interface ConversationSummary {
  clientId: string;
  photo?: string;
  unread: number;
  urgent: number;
  last: {
    text: string;
    isMine: boolean;
    isVoice: boolean;
    type: string | null;
    attachmentType: string | null;
    createdAt: string;
  } | null;
}

export interface ConversationRow extends ConversationSummary {
  name: string;
}

/** Heure du jour, « Hier », jour de la semaine sur 7 jours, sinon la date. */
function rowTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  if (now.getTime() - d.getTime() < 7 * 86400000) return d.toLocaleDateString("fr-FR", { weekday: "short" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function rowPreview(last: ConversationSummary["last"]) {
  if (!last) return "Aucun message pour l'instant";
  if (last.type === "plan_update") return "Programme mis à jour";
  const content = last.isVoice
    ? "Message vocal"
    : last.text.split("\n")[0] || (last.attachmentType === "video" ? "Vidéo" : last.attachmentType ? "Photo" : "Message");
  if (last.type === "broadcast") return `Annonce : ${content}`;
  return last.isMine ? `Toi : ${content}` : content;
}

function Row({ row, selected, onOpen }: { row: ConversationRow; selected: boolean; onOpen: (id: string) => void }) {
  const unread = selected ? 0 : row.unread;
  const urgent = !selected && row.urgent > 0;
  const toTreat = unread > 0;
  return (
    <button
      onClick={() => onOpen(row.clientId)}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition active:scale-[0.99] ${
        urgent
          ? "border-[1.5px] border-danger bg-danger/15"
          : selected || toTreat
          ? "bg-surface2"
          : ""
      }`}
    >
      <ChatAvatar name={row.name} photo={row.photo} size={toTreat ? 52 : 48} />
      <span className={`min-w-0 flex-1 ${toTreat ? "" : "border-b border-surface2 py-1.5"}`}>
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate ${toTreat ? "text-base font-black" : "text-[15px] font-bold"}`}>{row.name}</span>
          {row.last && (
            <span className={`shrink-0 text-xs ${urgent ? "font-black text-danger" : toTreat ? "font-black text-accent" : "text-dim"}`}>
              {rowTime(row.last.createdAt)}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className={`min-w-0 truncate text-sm ${toTreat ? "text-ink" : "text-dim"}`}>{rowPreview(row.last)}</span>
          {toTreat && !urgent && (
            <span className="grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] px-1.5 text-xs font-black text-[#1a1500]">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </span>
        {urgent && (
          <span className="mt-1 inline-block rounded-full bg-danger px-2 py-px text-[11px] font-black text-white">Urgent</span>
        )}
      </span>
    </button>
  );
}

/** Liste du coach : bloc « À traiter » (urgences puis non-lus), puis tous les autres sportifs. */
export default function ConversationList({ rows, selectedId, onOpen }: {
  rows: ConversationRow[];
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  const lastTime = (r: ConversationRow) => r.last?.createdAt ?? "";
  const toTreat = rows
    .filter(r => r.unread > 0 && r.clientId !== selectedId)
    .sort((a, b) => Number(b.urgent > 0) - Number(a.urgent > 0) || lastTime(b).localeCompare(lastTime(a)));
  const others = rows
    .filter(r => !(r.unread > 0 && r.clientId !== selectedId))
    .sort((a, b) => lastTime(b).localeCompare(lastTime(a)) || a.name.localeCompare(b.name, "fr"));

  return (
    <nav aria-label="Conversations" className="space-y-3">
      {toTreat.length > 0 && (
        <section className="space-y-1.5 rounded-[20px] bg-surface p-2">
          <h2 className="px-2 pb-0.5 pt-1 text-sm font-black">À traiter ({toTreat.length})</h2>
          {toTreat.map(r => <Row key={r.clientId} row={r} selected={false} onOpen={onOpen} />)}
        </section>
      )}
      {others.length > 0 && (
        <section>
          <h2 className="px-2 pb-1 text-sm font-black text-dim">
            {toTreat.length > 0 ? "Tous les sportifs" : "Sportifs"}
          </h2>
          {others.map(r => <Row key={r.clientId} row={r} selected={r.clientId === selectedId} onOpen={onOpen} />)}
        </section>
      )}
    </nav>
  );
}
