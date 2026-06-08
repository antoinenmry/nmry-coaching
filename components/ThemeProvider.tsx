"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

type Theme = "dark" | "light";
const KEY = "nmry-theme";

// Couleurs de fond par défaut par thème (correspondent à globals.css)
const DEFAULT_BG: Record<Theme, string> = {
  dark: "#0f1115",
  light: "#f4f5f7",
};

/** Clé localStorage pour la couleur de fond — user-specific si userId fourni. */
function bgKey(userId?: string | null) {
  return userId ? `nmry-bg-color-${userId}` : "nmry-bg-color";
}

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  bgColor: string;
  setBgColor: (color: string) => void;
  resetBgColor: () => void;
  /** Appelé dès que l'userId est connu (par BgColorSyncer). Charge la couleur propre à ce compte. */
  syncForUser: (userId: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
  bgColor: DEFAULT_BG.dark,
  setBgColor: () => {},
  resetBgColor: () => {},
  syncForUser: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyBgColor(color: string) {
  document.documentElement.style.setProperty("--color-bg", color);
}

function clearBgColor() {
  document.documentElement.style.removeProperty("--color-bg");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [bgColor, setBgColorState] = useState<string>(DEFAULT_BG.dark);
  // userId courant — mis à jour par syncForUser() une fois l'auth chargée
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme | null) ?? "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);

    // Appliquer la couleur de fond globale (avant auth — legacy key)
    const savedBg = localStorage.getItem(bgKey());
    if (savedBg) {
      setBgColorState(savedBg);
      applyBgColor(savedBg);
    } else {
      setBgColorState(DEFAULT_BG[saved]);
    }
  }, []);

  /** Charge et applique la couleur de fond propre à cet userId. */
  function syncForUser(userId: string) {
    userIdRef.current = userId;
    const currentTheme = (localStorage.getItem(KEY) as Theme | null) ?? "dark";
    const saved = localStorage.getItem(bgKey(userId));
    if (saved) {
      setBgColorState(saved);
      applyBgColor(saved);
    } else {
      // Pas de couleur custom pour cet user → défaut du thème
      setBgColorState(DEFAULT_BG[currentTheme]);
      clearBgColor();
    }
  }

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(KEY, next);
    document.documentElement.setAttribute("data-theme", next);

    // Si pas de couleur custom pour l'user courant, on suit le thème
    if (!localStorage.getItem(bgKey(userIdRef.current))) {
      setBgColorState(DEFAULT_BG[next]);
    }
  }

  function setBgColor(color: string) {
    setBgColorState(color);
    // Sauvegarde sous la clé user-specific (ou globale si pas encore d'userId)
    localStorage.setItem(bgKey(userIdRef.current), color);
    applyBgColor(color);
  }

  function resetBgColor() {
    setBgColorState(DEFAULT_BG[theme]);
    localStorage.removeItem(bgKey(userIdRef.current));
    clearBgColor();
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, bgColor, setBgColor, resetBgColor, syncForUser }}>
      {children}
    </ThemeContext.Provider>
  );
}
