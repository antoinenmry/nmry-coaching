"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useData } from "./DataProvider";

// Lundi de la semaine en cours (YYYY-MM-DD)
function thisMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ClientSelector() {
  const { clients, activeUserId, switchClient, role, me, loading, planNotifSentAt } = useData();
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
      minWidth: Math.max(r.width, 240),
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

  const monday = thisMonday();

  function notifiedThisWeek(id: string): boolean {
    const ts = planNotifSentAt[id];
    return !!ts && ts.slice(0, 10) >= monday;
  }

  const others = clients.filter((c) => c.id !== me?.id);
  const coaches = others.filter((c) => c.role === "coach" || c.role === "admin");
  // Sportifs : non-notifiés cette semaine d'abord, notifiés en bas (alpha dans chaque groupe)
  const rawSportifs = others.filter((c) => c.role === "client");
  const sortedSportifs = useMemo(() => {
    return [...rawSportifs].sort((a, b) => {
      const an = notifiedThisWeek(a.id);
      const bn = notifiedThisWeek(b.id);
      if (an !== bn) return an ? 1 : -1;
      return (a.name || a.email).localeCompare(b.name || b.email);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawSportifs, planNotifSentAt, monday]);

  const active = clients.find((c) => c.id === activeUserId) ?? me;
  const activeLabel = active ? (active.name || active.email) : "—";

  // Dot de couleur selon le type de profil
  function ProfileDot({ profileId, profileRole }: { profileId: string; profileRole: string }) {
    const color =
      profileId === me?.id
        ? "bg-amber-400"          // moi → jaune
        : profileRole === "coach" || profileRole === "admin"
        ? "bg-orange-400"         // autre coach/admin → orange
        : "bg-sky-400";           // sportif → bleu ciel
    return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />;
  }

  function Row({ c, last }: { c: NonNullable<typeof me>; last?: boolean }) {
    if (!c) return null;
    const isActive = c.id === activeUserId;
    const notified = notifiedThisWeek(c.id);
    return (
      <button
        onClick={() => { switchClient(c.id); setOpen(false); }}
        className={[
          "flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm hover:bg-surface2",
          last ? "rounded-b-2xl" : "",
          isActive ? "bg-surface2/50" : "",
        ].join(" ")}
      >
        <ProfileDot profileId={c.id} profileRole={c.role} />
        <span className={`flex-1 truncate font-medium ${isActive ? "text-accent" : "text-ink"}`}>
          {c.name || c.email}
        </span>
        {notified && c.role === "client" && (
          <span className="text-[11px] text-ok" title="Programme envoyé cette semaine">✅</span>
        )}
        {isActive && <span className="text-ok text-xs">✓</span>}
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
            "flex w-full items-center gap-2.5 rounded-t-2xl px-4 py-3 text-left text-sm hover:bg-surface2",
            me.id === activeUserId ? "bg-surface2/50" : "",
          ].join(" ")}
        >
          <ProfileDot profileId={me.id} profileRole={me.role} />
          <span className={`flex-1 truncate font-medium ${me.id === activeUserId ? "text-accent" : "text-ink"}`}>
            {me.name || me.email}
          </span>
          <span className="text-xs text-dim">(moi)</span>
          {me.id === activeUserId && <span className="text-ok text-xs">✓</span>}
        </button>
      )}

      {/* Autres coachs / admins */}
      {coaches.length > 0 && (
        <>
          <div className="border-t border-line px-4 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-dim">Coachs</span>
          </div>
          {coaches.map((c) => <Row key={c.id} c={c} />)}
        </>
      )}

      {/* Sportifs */}
      {sortedSportifs.length > 0 && (
        <>
          <div className="border-t border-line px-4 py-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-dim">Sportifs</span>
            {sortedSportifs.some((c) => notifiedThisWeek(c.id)) && (
              <span className="text-[10px] text-dim">✅ = programme envoyé</span>
            )}
          </div>
          {sortedSportifs.map((c, i) => (
            <Row key={c.id} c={c} last={i === sortedSportifs.length - 1} />
          ))}
        </>
      )}

      {others.length === 0 && (
        <p className="rounded-b-2xl px-4 py-3 text-sm text-dim">Aucun profil enregistré</p>
      )}
    </div>,
    document.body
  ) : null;

  // Dot du profil actif dans le bouton trigger
  const activeDotColor =
    !active || active.id === me?.id
      ? "bg-amber-400"
      : active.role === "coach" || active.role === "admin"
      ? "bg-orange-400"
      : "bg-sky-400";

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
          <>
            <span className={`h-2 w-2 shrink-0 rounded-full ${activeDotColor}`} />
            <span className="max-w-[140px] truncate text-accent">{activeLabel}</span>
          </>
        )}
        <span className="text-xs text-dim">{open ? "▲" : "▼"}</span>
      </button>

      {dropdown}
    </>
  );
}
