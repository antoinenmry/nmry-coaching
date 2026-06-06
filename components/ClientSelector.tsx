"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useData } from "./DataProvider";

export default function ClientSelector() {
  const { clients, activeUserId, switchClient, role, me, loading } = useData();
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Positionner le dropdown en fixed sous le bouton
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: r.bottom + 6,
      left: r.left,
      minWidth: Math.max(r.width, 220),
      zIndex: 9999,
    });
  }, [open]);

  // Fermer en cliquant en dehors
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (role !== "coach" && role !== "admin") return null;

  // Coach : ses clients affectés. Admin : tous les profils (clients + coaches sauf soi)
  const coachableClients = role === "admin"
    ? clients.filter((c) => c.id !== me?.id)
    : clients.filter((c) => c.role === "client");
  const active = clients.find((c) => c.id === activeUserId);
  const activeLabel = active ? (active.name || active.email) : "—";

  const dropdown = open && typeof document !== "undefined" ? createPortal(
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="rounded-2xl border border-line bg-surface shadow-xl"
    >
      {coachableClients.length === 0 && (
        <p className="px-4 py-3 text-sm text-dim">Aucun sportif enregistré</p>
      )}
      {coachableClients.map((c, i) => (
        <button
          key={c.id}
          onClick={() => { switchClient(c.id); setOpen(false); }}
          className={[
            "flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-surface2",
            i === 0 ? "rounded-t-2xl" : "",
            i === coachableClients.length - 1 && !me ? "rounded-b-2xl" : "",
            c.id === activeUserId ? "font-semibold text-accent" : "",
          ].join(" ")}
        >
          <span className="flex-1 truncate">{c.name || c.email}</span>
          <span className="truncate text-xs text-dim">{c.name ? c.email : ""}</span>
          {c.id === activeUserId && <span className="text-ok">✓</span>}
        </button>
      ))}

      {/* Le coach peut aussi consulter ses propres données */}
      {me && (
        <button
          onClick={() => { switchClient(me.id); setOpen(false); }}
          className={[
            "flex w-full items-center gap-2 rounded-b-2xl border-t border-line px-4 py-3 text-left text-sm hover:bg-surface2",
            me.id === activeUserId ? "font-semibold text-accent" : "text-dim",
          ].join(" ")}
        >
          <span className="flex-1 truncate">{me.name || me.email}</span>
          <span className="text-xs">(moi)</span>
          {me.id === activeUserId && <span className="text-ok">✓</span>}
        </button>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        <span className="text-xs text-dim">Sportif :</span>
        {loading ? (
          <span className="h-3.5 w-20 animate-pulse rounded bg-surface2" />
        ) : (
          <span className="max-w-[140px] truncate text-accent">{activeLabel}</span>
        )}
        <span className="text-xs text-dim">{open ? "▲" : "▼"}</span>
      </button>

      {dropdown}
    </>
  );
}
