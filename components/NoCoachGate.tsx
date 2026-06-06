"use client";

import { useData } from "@/components/DataProvider";
import NoCoachScreen from "@/components/NoCoachScreen";

/**
 * NoCoachGate
 * Bloque l'accès à l'app pour les sportifs sans coach affecté.
 * Les coaches, admins, et le mode local passent toujours.
 */
export default function NoCoachGate({ children }: { children: React.ReactNode }) {
  const { role, hasCoach, loading } = useData();

  // Pendant le chargement, on laisse passer (le layout affiche son propre skeleton)
  if (loading) return <>{children}</>;

  // Coaches et admins ont toujours accès
  if (role === "coach" || role === "admin") return <>{children}</>;

  // Client sans coach → écran d'attente
  if (!hasCoach) return <NoCoachScreen />;

  return <>{children}</>;
}
