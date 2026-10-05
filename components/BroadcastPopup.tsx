"use client";

/**
 * BroadcastPopup
 * ─────────────────────────────────────────────────────────────────────────────
 * Affiché pour les sportifs uniquement.
 * • Au montage : charge les broadcasts actifs non encore vus (localStorage).
 * • En temps réel : subscribe aux nouveaux broadcasts via Supabase Realtime.
 * • Le sportif ferme la popup → l'ID est sauvegardé dans localStorage (ne réapparaît plus).
 */

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/DataProvider";

interface Broadcast {
  id: string;
  message: string;
  created_at: string;
  coachName?: string;
  coachPhoto?: string;
}

const STORAGE_KEY = "nmry_seen_broadcasts";

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  try {
    const seen = getSeenIds();
    seen.add(id);
    // On garde max 200 IDs pour éviter un localStorage infini
    const arr = Array.from(seen).slice(-200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // silently fail
  }
}

export default function BroadcastPopup() {
  const { role, me } = useData();
  const [queue, setQueue] = useState<Broadcast[]>([]);
  const coachIdRef = useRef<string | null>(null);

  // Seulement pour les sportifs
  const isClient = role === "client";

  // Charger les broadcasts actifs au montage
  useEffect(() => {
    if (!isClient || !me) return;

    fetch("/api/broadcasts")
      .then((r) => r.json())
      .then((data: Broadcast[]) => {
        if (!Array.isArray(data)) return;
        const seen = getSeenIds();
        const unseen = data.filter((b) => !seen.has(b.id));
        if (unseen.length > 0) setQueue(unseen);
      })
      .catch(() => {});
  }, [isClient, me]);

  // Subscribe Realtime aux nouveaux broadcasts
  useEffect(() => {
    if (!isClient || !me) return;

    const supabase = createClient();

    // D'abord récupérer le coach_id pour filtrer les événements Realtime
    supabase
      .from("coach_client")
      .select("coach_id")
      .eq("client_id", me.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.coach_id) return;
        coachIdRef.current = data.coach_id;

        const channel = supabase
          .channel(`broadcasts:coach_id=eq.${data.coach_id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "broadcasts",
              filter: `coach_id=eq.${data.coach_id}`,
            },
            (payload) => {
              const b = payload.new as Broadcast & { expires_at: string };
              // Vérifier que pas encore expiré et pas déjà vu
              if (new Date(b.expires_at) < new Date()) return;
              const seen = getSeenIds();
              if (seen.has(b.id)) return;
              setQueue((prev) => [b, ...prev]);
              // Le payload Realtime n'a pas l'identité du coach : on la récupère
              // (nom + photo) puis on enrichit la carte déjà affichée.
              fetch("/api/broadcasts")
                .then((r) => r.json())
                .then((all: Broadcast[]) => {
                  const full = Array.isArray(all) ? all.find((x) => x.id === b.id) : null;
                  if (full) setQueue((prev) => prev.map((x) => (x.id === b.id ? { ...x, ...full } : x)));
                })
                .catch(() => {});
            }
          )
          .subscribe();

        return () => { supabase.removeChannel(channel); };
      });
  }, [isClient, me]);

  if (!isClient || queue.length === 0) return null;

  const current = queue[0];

  function dismiss() {
    markSeen(current.id);
    setQueue((prev) => prev.slice(1));
  }

  function fmtDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  }

  const coachName = current.coachName || "Votre coach";
  const initial = coachName.trim().charAt(0).toUpperCase() || "C";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-5">
      {/* La bulle photo déborde de la carte, en bas à droite : conteneur sans overflow-hidden */}
      <div className="relative w-full max-w-sm rounded-3xl border border-line bg-surface px-5 pb-8 pt-5 shadow-2xl">
        <p className="text-[10.5px] font-black uppercase tracking-[0.12em] text-accent">
          {coachName} · votre coach
        </p>
        <p className="mt-0.5 text-[11.5px] text-dim">{fmtDate(current.created_at)}</p>
        <p className="mb-5 mt-3 whitespace-pre-wrap pr-10 text-[15px] leading-relaxed">{current.message}</p>
        <button
          onClick={dismiss}
          className="w-full rounded-full bg-gradient-to-br from-[#ffc53d] to-[#ff9f00] py-3 text-sm font-black text-[#1a1500] transition active:scale-95"
        >
          {queue.length > 1 ? `OK (${queue.length - 1} autre${queue.length - 1 > 1 ? "s" : ""})` : "OK, j'ai lu !"}
        </button>
        <div className="absolute -bottom-6 -right-1.5 grid h-[76px] w-[76px] place-items-center overflow-hidden rounded-full border-4 border-bg bg-gradient-to-br from-[#8b6b4a] to-[#3a2c20] text-[26px] font-black text-white shadow-[0_10px_24px_-6px_rgba(0,0,0,0.7)]">
          {current.coachPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.coachPhoto} alt={coachName} className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>
      </div>
    </div>
  );
}
