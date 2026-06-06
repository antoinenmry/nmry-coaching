"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useData } from "./DataProvider";
import { useTheme } from "./ThemeProvider";
import ClientSelector from "./ClientSelector";

const TITLES: Record<string, string> = {
  "/": "NMRY-coaching",
  "/profile": "Mon Profil",
  "/plan": "Programmation",
  "/goals": "Mes Objectifs",
  "/records": "Mes Records",
  "/followup": "Mon Suivi",
  "/library": "Ma Bibliothèque",
  "/settings": "Réglages",
  "/overview": "Vue d'ensemble",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { saving, role, me, activeUserId, previewAsClient, setPreviewAsClient } = useData();
  const { theme } = useTheme();
  const isHome = pathname === "/";
  const realRole = me?.role;
  const isElevated = realRole === "coach" || realRole === "admin";
  // Affiche le toggle aperçu uniquement si coach/admin consulte le profil d'un autre
  const showPreview = isElevated && activeUserId !== me?.id;

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
          {isHome ? (
            <Image
              src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
              alt="NMRY Coaching"
              width={140}
              height={48}
              className="mx-auto h-10 w-auto object-contain"
              priority
            />
          ) : (
            TITLES[pathname] ?? "NMRY"
          )}
        </h1>
        <div className="grid h-10 w-10 place-items-center text-xs text-dim">
          {saving ? "…" : ""}
        </div>
      </div>

      {/* Bandeau inférieur : sélecteur client à gauche, aperçu + ⚙ à droite */}
      <div className="flex items-center justify-between border-t border-line/50 px-4 py-2">
        {(role === "coach" || role === "admin") ? <ClientSelector /> : <div />}
        <div className="flex items-center gap-2">
          {showPreview && (
            <button
              onClick={() => setPreviewAsClient(!previewAsClient)}
              title={previewAsClient ? "Quitter l'aperçu sportif" : "Voir en tant que sportif"}
              className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                previewAsClient
                  ? "bg-accent text-[#1a1500]"
                  : "bg-surface2 text-dim hover:text-ink"
              }`}
            >
              {previewAsClient ? "👁 Aperçu actif" : "👁 Aperçu"}
            </button>
          )}
          <Link
            href="/settings"
            aria-label="Réglages"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface2 text-base"
          >
            ⚙
          </Link>
        </div>
      </div>
    </header>
  );
}
