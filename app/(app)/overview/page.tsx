"use client";

import { useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";
import { createClient } from "@/lib/supabase/client";
import { daysUntil, countdownLabel, frenchDate } from "@/lib/dates";
import type { AppState, Goal, Followup, Profile, ChatMessage } from "@/lib/types";
import { emptyState } from "@/lib/types";

interface ClientData {
  profile: Profile;
  goals: Goal[];
  injuries: Followup[];
  urgentMessages: ChatMessage[];
}

export default function OverviewPage() {
  const { clients, role, loading: ctxLoading } = useData();
  const [data, setData] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"injuries" | "goals">("injuries");

  useEffect(() => {
    if (ctxLoading) return;
    if (role !== "coach" && role !== "admin") { setLoading(false); return; }

    const supabase = createClient();
    const clientProfiles = clients.filter((c) => c.role === "client");

    (async () => {
      if (clientProfiles.length === 0) { setLoading(false); return; }
      const ids = clientProfiles.map((c) => c.id);
      const { data: rows } = await supabase
        .from("app_state")
        .select("user_id,data")
        .in("user_id", ids);

      const result: ClientData[] = clientProfiles.map((profile) => {
        const row = rows?.find((r) => r.user_id === profile.id);
        const state: AppState = { ...emptyState(), ...(row?.data ?? {}) };
        return {
          profile,
          goals: state.goals ?? [],
          injuries: (state.followups ?? []).filter((f) => f.type === "injury"),
          urgentMessages: (state.messages ?? []).filter(m => m.isUrgent && !m.isRead),
        };
      });

      setData(result);
      setLoading(false);
    })();
  }, [ctxLoading, clients, role]);

  if (ctxLoading || loading) {
    return <p className="py-10 text-center text-dim">Chargement…</p>;
  }

  if (role !== "coach" && role !== "admin") {
    return <p className="py-10 text-center text-dim">Accès réservé au coach.</p>;
  }

  // Agrégation globale — messages urgents non lus
  const allUrgent = data.flatMap(cd =>
    cd.urgentMessages.map(m => ({
      ...m,
      clientName: cd.profile.name || cd.profile.email,
    }))
  );

  // Agrégation globale — blessures
  const allInjuries: (Followup & { clientName: string })[] = data
    .flatMap((cd) =>
      cd.injuries.map((f) => ({
        ...f,
        clientName: cd.profile.name || cd.profile.email,
      }))
    )
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // Agrégation globale — objectifs
  const allGoals: (Goal & { clientName: string })[] = data
    .flatMap((cd) =>
      cd.goals.map((g) => ({
        ...g,
        clientName: cd.profile.name || cd.profile.email,
      }))
    )
    .sort((a, b) => {
      const da = daysUntil(a.date) ?? Infinity;
      const db = daysUntil(b.date) ?? Infinity;
      // À venir : croissant (le plus proche en premier)
      // Passés : décroissant (le plus récent en premier)
      const futureA = da >= 0;
      const futureB = db >= 0;
      if (futureA && !futureB) return -1;
      if (!futureA && futureB) return 1;
      return futureA ? da - db : db - da;
    });

  const today = new Date().toISOString().slice(0, 10);
  const activeInjuries = allInjuries.filter(
    (f) => f.date <= today && (!f.dateEnd || f.dateEnd >= today),
  );
  const injuryCount = allInjuries.length;
  const goalCount = allGoals.filter((g) => (daysUntil(g.date) ?? -1) >= 0).length;

  return (
    <div>
      <p className="mb-4 text-sm text-dim">{data.length} sportif{data.length > 1 ? "s" : ""}</p>

      {/* Bandeau messages urgents non lus */}
      {allUrgent.length > 0 && (
        <div className="mb-4 rounded-2xl border border-danger/50 bg-danger/8 p-4">
          <p className="mb-2.5 flex items-center gap-2 font-bold text-danger">
            🚨 {allUrgent.length} message{allUrgent.length > 1 ? "s" : ""} urgent{allUrgent.length > 1 ? "s" : ""} non lu{allUrgent.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-2">
            {allUrgent.map(m => (
              <div key={m.id} className="flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2">
                <span className="mt-0.5 shrink-0 text-[13px] font-bold text-danger">{m.clientName}</span>
                <span className="text-dim">—</span>
                <span className="text-[13px] leading-snug">{m.isVoice ? "🎤 Message vocal" : m.text.slice(0, 80)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bandeau blessures actives */}
      {activeInjuries.length > 0 && (
        <div className="mb-4 rounded-2xl border border-danger/50 bg-danger/8 p-4">
          <p className="mb-2.5 flex items-center gap-2 font-bold text-danger">
            🩹 {activeInjuries.length} blessure{activeInjuries.length > 1 ? "s" : ""} active{activeInjuries.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-2">
            {activeInjuries.map((f) => (
              <div key={f.id} className="flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2">
                <span className="mt-0.5 shrink-0 text-[13px] font-bold text-danger">{f.clientName}</span>
                <span className="text-dim">—</span>
                <span className="text-[13px] leading-snug">{f.text.split("\n")[0].slice(0, 80)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Onglets */}
      <div className="mb-4 flex rounded-lg bg-surface2 p-1">
        <button
          onClick={() => setTab("injuries")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${tab === "injuries" ? "bg-danger text-white" : "text-dim"}`}
        >
          🩹 Blessures{injuryCount > 0 ? ` (${injuryCount})` : ""}
        </button>
        <button
          onClick={() => setTab("goals")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${tab === "goals" ? "bg-accent text-[#1a1500]" : "text-dim"}`}
        >
          🎯 Objectifs{goalCount > 0 ? ` (${goalCount})` : ""}
        </button>
      </div>

      {/* Blessures */}
      {tab === "injuries" && (
        <div className="space-y-2.5">
          {allInjuries.length === 0 ? (
            <p className="py-10 text-center text-dim">Aucune blessure déclarée.</p>
          ) : (
            allInjuries.map((f) => {
              const today = new Date().toISOString().slice(0, 10);
              const active = f.date <= today && (!f.dateEnd || f.dateEnd >= today);
              return (
                <div key={f.id} className={`rounded-xl border p-3.5 ${active ? "border-danger/50 bg-danger/5" : "border-line bg-surface"}`}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-danger">{f.clientName}</span>
                      {active && <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">Active</span>}
                    </div>
                    <span className="text-[12px] text-dim">
                      {f.dateEnd
                        ? `${frenchDate(f.date)} → ${frenchDate(f.dateEnd)}`
                        : `depuis le ${frenchDate(f.date)}`}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{f.text}</p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Objectifs */}
      {tab === "goals" && (
        <div className="space-y-2.5">
          {allGoals.length === 0 ? (
            <p className="py-10 text-center text-dim">Aucun objectif déclaré.</p>
          ) : (
            allGoals.map((g) => {
              const n = daysUntil(g.date);
              const future = n !== null && n >= 0;
              return (
                <div key={`${g.id}-${g.clientName}`} className="rounded-xl border border-line bg-surface p-3.5">
                  <div className="mb-1 flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold text-accent">{g.clientName}</span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold ${
                        future ? "bg-ok/20 text-ok" : "bg-surface2 text-dim"
                      }`}
                    >
                      {countdownLabel(g.date)}
                    </span>
                  </div>
                  <p className="font-semibold">{g.competition}</p>
                  <p className="mt-0.5 text-[12px] text-dim">
                    {frenchDate(g.date)}{g.place ? ` · ${g.place}` : ""}
                  </p>
                  {g.expected && (
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-dim">{g.expected}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
