"use client";

/**
 * BgColorSyncer — composant sans rendu, monté dans l'app layout.
 *
 * Règle : la couleur de fond custom ne s'applique QUE quand le coach voit
 * son propre profil (activeUserId === me.id ou null).
 * Quand il consulte un sportif → fond par défaut du thème.
 * Quand il revient sur son profil → sa couleur custom revient.
 */

import { useEffect } from "react";
import { useData } from "@/components/DataProvider";
import { useTheme } from "@/components/ThemeProvider";

export default function BgColorSyncer() {
  const { me, activeUserId } = useData();
  const { syncForUser, applyDefault } = useTheme();

  // Au chargement ou changement de me.id → charger la couleur de ce compte
  useEffect(() => {
    if (me?.id) syncForUser(me.id);
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quand activeUserId change : on est sur son propre profil → couleur custom,
  // sur un sportif → fond par défaut.
  useEffect(() => {
    if (!me?.id) return;
    if (!activeUserId || activeUserId === me.id) {
      syncForUser(me.id);
    } else {
      applyDefault();
    }
  }, [activeUserId, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
