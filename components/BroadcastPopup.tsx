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

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center p-4">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-surface shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-accent px-5 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📢</span>
            <div>
              <p className="font-black text-[#1a1500] text-lg leading-tight">Message de votre coach</p>
              <p className="text-[12px] text-[#1a1500]/70">{fmtDate(current.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Corps */}
        <div className="px-5 py-5">
          <p className="text-base leading-relaxed whitespace-pre-wrap">{current.message}</p>
        </div>

        {/* Bouton */}
        <div className="px-5 pb-5">
          <button
            onClick={dismiss}
            className="w-full rounded-2xl bg-accent py-3 font-bold text-[#1a1500] text-sm transition active:scale-95"
          >
            {queue.length > 1 ? `OK (${queue.length - 1} autre${queue.length - 1 > 1 ? "s" : ""})` : "OK, j'ai lu !"}
          </button>
        </div>
      </div>
    </div>
  );
}
