import type { GoalEvent } from "@/lib/types";

export default function EventsDisplay({ events }: { events: GoalEvent[] }) {
  if (!events || events.length === 0) return null;
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-3 border-b border-line bg-surface2 px-3 py-1.5">
        <span className="text-[11px] font-semibold text-dim">Épreuve</span>
        <span className="text-[11px] font-semibold text-dim">Prévu</span>
        <span className="text-[11px] font-semibold text-dim">Réalisé</span>
      </div>
      {events.map((e) => (
        <div key={e.id} className="grid grid-cols-3 border-b border-line px-3 py-2 last:border-0">
          <span className="text-[13px] font-medium">{e.name || "—"}</span>
          <span className="text-[13px] text-dim">{e.planned || "—"}</span>
          <span className={`text-[13px] font-semibold ${e.achieved ? "text-ok" : "text-dim"}`}>
            {e.achieved || "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
