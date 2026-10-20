"use client";

import { useEffect, useState } from "react";
import { useData } from "@/components/DataProvider";
import CheckinSheet from "@/components/CheckinSheet";
import { hasCheckin, localDateKey } from "@/lib/checkin";

/** Ouvre le check-in à la première ouverture de la journée (une seule fois, sur son propre profil). */
export default function CheckinPopup() {
  const { loading, me, activeUserId, state } = useData();
  const [open, setOpen] = useState(false);
  const day = localDateKey();
  const ready = !loading && !!me && activeUserId === me.id;
  const disabled = state.preferences?.checkinDisabled === true;
  const done = hasCheckin(state, day);

  useEffect(() => {
    if (!ready || disabled || done) return;
    const key = `nmry_checkin_${me!.id}_${day}`;
    try { if (localStorage.getItem(key)) return; } catch { /* stockage indisponible : on propose quand même */ }
    // Petit délai : laisse l'accueil (et un éventuel message du coach) s'afficher d'abord.
    const t = setTimeout(() => {
      try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
      setOpen(true);
    }, 1500);
    return () => clearTimeout(t);
  }, [ready, disabled, done, day, me]);

  if (!open) return null;
  return <CheckinSheet onClose={() => setOpen(false)} />;
}
