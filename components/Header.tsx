"use client";

import { usePathname, useRouter } from "next/navigation";
import { useData } from "./DataProvider";
import ClientSelector from "./ClientSelector";

const TITLES: Record<string, string> = {
  "/": "NMRY-coaching",
  "/profile": "Profil",
  "/plan": "Planning",
  "/goals": "Objectifs",
  "/followup": "Suivi",
  "/library": "Bibliothèque",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { saving, role } = useData();
  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <div className="flex items-center gap-2 px-4 py-3">
        {!isHome ? (
          <button
            onClick={() => router.push("/")}
            aria-label="Retour"
            className="grid h-10 w-10 place-items-center rounded-lg bg-surface2 text-xl"
          >
            ←
          </button>
        ) : (
          <div className="h-10 w-10" />
        )}
        <h1 className="flex-1 text-center text-lg font-bold tracking-[0.15em]">
          {TITLES[pathname] ?? "NMRY"}
        </h1>
        <div className="grid h-10 w-10 place-items-center text-xs text-dim">
          {saving ? "…" : ""}
        </div>
      </div>

      {/* Bandeau de sélection client — visible uniquement pour le coach */}
      {role === "coach" && (
        <div className="flex items-center justify-center border-t border-line/50 px-4 py-2">
          <ClientSelector />
        </div>
      )}
    </header>
  );
}
