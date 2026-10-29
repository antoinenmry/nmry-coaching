"use client";

import { useMemo } from "react";
import { useData } from "@/components/DataProvider";
import { valueTypeResolver } from "@/lib/exerciseUnit";

/** (exId, nom) → type de valeur attendu (kg/RPE/% · min/km · km/h) d'après la bibliothèque. */
export function useValueTypes() {
  const { library } = useData();
  return useMemo(() => valueTypeResolver(library), [library]);
}
