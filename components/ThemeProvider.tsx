"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { clampBgForTheme, type ThemeName } from "@/lib/themeColor";

type Theme = ThemeName;
const KEY = "nmry-theme";
const THEMES: Theme[] = ["dark", "light", "aurora"];

/** Thème mémorisé, ou sombre si absent ou inconnu. */
function readSavedTheme(): Theme {
  const t = localStorage.getItem(KEY) as Theme | null;
  return t && THEMES.includes(t) ? t : "dark";
}

// Couleurs de fond par défaut par thème (correspondent à globals.css)
const DEFAULT_BG: Record<Theme, string> = {
  dark: "#0f1115",
  light: "#f4f5f7",
  aurora: "#060a14",
};

/** Clé localStorage pour la couleur de fond — user-specific si userId fourni. */
function bgKey(userId?: string | null) {
  return userId ? `nmry-bg-color-${userId}` : "nmry-bg-color";
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  bgColor: string;
  setBgColor: (color: string) => void;
  resetBgColor: () => void;
  /** Appelé dès que l'userId est connu (par BgColorSyncer). Charge la couleur propre à ce compte. */
  syncForUser: (userId: string) => void;
  /** Applique le fond par défaut du thème SANS toucher au localStorage. */
  applyDefault: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  bgColor: DEFAULT_BG.dark,
  setBgColor: () => {},
  resetBgColor: () => {},
  syncForUser: () => {},
  applyDefault: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/** Pose la couleur de fond choisie, BORNÉE pour rester lisible dans le thème courant
 *  (cf. lib/themeColor.ts). En Aurora, pas de fond personnalisé : l'aurore EST le fond. */
function applyBgColor(color: string, theme: Theme) {
  if (theme === "aurora") return clearBgColor();
  document.documentElement.style.setProperty("--color-bg", clampBgForTheme(color, theme));
}

function clearBgColor() {
  document.documentElement.style.removeProperty("--color-bg");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [bgColor, setBgColorState] = useState<string>(DEFAULT_BG.dark);
  // userId courant — mis à jour par syncForUser() une fois l'auth chargée
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const saved = readSavedTheme();
    setThemeState(saved);
    document.documentElement.setAttribute("data-theme", saved);

    // Appliquer la couleur de fond globale (avant auth — legacy key)
    const savedBg = localStorage.getItem(bgKey());
    if (savedBg) {
      setBgColorState(savedBg);
      applyBgColor(savedBg, saved);
    } else {
      setBgColorState(DEFAULT_BG[saved]);
    }
  }, []);

  /** Charge et applique la couleur de fond propre à cet userId. */
  function syncForUser(userId: string) {
    userIdRef.current = userId;
    const currentTheme = readSavedTheme();
    const saved = localStorage.getItem(bgKey(userId));
    if (saved) {
      setBgColorState(saved);
      applyBgColor(saved, currentTheme);
    } else {
      // Pas de couleur custom pour cet user → défaut du thème
      setBgColorState(DEFAULT_BG[currentTheme]);
      clearBgColor();
    }
  }

  function setTheme(next: Theme) {
    setThemeState(next);
    localStorage.setItem(KEY, next);
    document.documentElement.setAttribute("data-theme", next);

    // La couleur personnalisée est re-bornée pour le NOUVEAU thème (un fond sombre
    // choisi en mode sombre n'a pas sa place en mode clair, et inversement).
    const saved = localStorage.getItem(bgKey(userIdRef.current));
    if (saved) {
      applyBgColor(saved, next);
    } else {
      setBgColorState(DEFAULT_BG[next]);
      clearBgColor();
    }
  }

  function setBgColor(color: string) {
    setBgColorState(color);
    // Sauvegarde sous la clé user-specific (ou globale si pas encore d'userId)
    localStorage.setItem(bgKey(userIdRef.current), color);
    applyBgColor(color, theme);
  }

  function resetBgColor() {
    setBgColorState(DEFAULT_BG[theme]);
    localStorage.removeItem(bgKey(userIdRef.current));
    clearBgColor();
  }

  /** Applique le fond par défaut du thème SANS toucher au localStorage ni au state. */
  function applyDefault() {
    clearBgColor();
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, bgColor, setBgColor, resetBgColor, syncForUser, applyDefault }}>
      {children}
    </ThemeContext.Provider>
  );
}
