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

  const others = clients.filter((c) => c.id !== me?.id);
  const coaches = others.filter((c) => c.role === "coach" || c.role === "admin");
  const sportifs = others.filter((c) => c.role === "client");
  const active = clients.find((c) => c.id === activeUserId) ?? me;
  const activeLabel = active ? (active.name || active.email) : "—";

  function Row({ c, last }: { c: typeof me & object; last?: boolean }) {
    if (!c) return null;
    const isActive = c.id === activeUserId;
    return (
      <button
        onClick={() => { switchClient(c.id); setOpen(false); }}
        className={[
          "flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-surface2",
          last ? "rounded-b-2xl" : "",
          isActive ? "font-semibold text-accent" : "",
        ].join(" ")}
      >
        <span className="flex-1 truncate">{c.name || c.email}</span>
        <span className="truncate text-xs text-dim">{c.name ? c.email : ""}</span>
        {isActive && <span className="text-ok">✓</span>}
      </button>
    );
  }

  const dropdown = open && typeof document !== "undefined" ? createPortal(
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
    >
      {/* Moi en premier */}
      {me && (
        <button
          onClick={() => { switchClient(me.id); setOpen(false); }}
          className={[
            "flex w-full items-center gap-2 rounded-t-2xl px-4 py-3 text-left text-sm hover:bg-surface2",
            me.id === activeUserId ? "font-semibold text-accent" : "",
          ].join(" ")}
        >
          <span className="flex-1 truncate">{me.name || me.email}</span>
          <span className="text-xs text-dim">(moi)</span>
          {me.id === activeUserId && <span className="text-ok">✓</span>}
        </button>
      )}

      {/* Coaches */}
      {coaches.length > 0 && (
        <>
          <div className="border-t border-line px-4 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-dim">Coachs</span>
          </div>
          {coaches.map((c) => <Row key={c.id} c={c} />)}
        </>
      )}

      {/* Sportifs */}
      {sportifs.length > 0 && (
        <>
          <div className="border-t border-line px-4 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-dim">Sportifs</span>
          </div>
          {sportifs.map((c, i) => <Row key={c.id} c={c} last={i === sportifs.length - 1} />)}
        </>
      )}

      {others.length === 0 && (
        <p className="rounded-b-2xl px-4 py-3 text-sm text-dim">Aucun profil enregistré</p>
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
        <span className="text-xs text-dim">{role === "admin" ? "Profil :" : "Sportif :"}</span>
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
