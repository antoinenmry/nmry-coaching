"use client";

/**
 * BgColorSyncer — composant sans rendu, monté dans l'app layout.
 * Il lit `me.id` depuis DataProvider et appelle `syncForUser` dans ThemeProvider
 * dès que l'userId est connu, pour charger la couleur de fond propre à ce compte.
 */

import { useEffect } from "react";
import { useData } from "@/components/DataProvider";
import { useTheme } from "@/components/ThemeProvider";

export default function BgColorSyncer() {
  const { me } = useData();
  const { syncForUser } = useTheme();

  useEffect(() => {
    if (me?.id) syncForUser(me.id);
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
