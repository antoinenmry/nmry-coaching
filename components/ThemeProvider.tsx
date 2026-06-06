"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";
const KEY = "nmry-theme";
const BG_KEY = "nmry-bg-color";

// Couleurs de fond par défaut par thème (correspondent à globals.css)
const DEFAULT_BG: Record<Theme, string> = {
  dark: "#0f1115",
  light: "#f4f5f7",
};

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  bgColor: string;
  setBgColor: (color: string) => void;
  resetBgColor: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
  bgColor: DEFAULT_BG.dark,
  setBgColor: () => {},
  resetBgColor: () => {},
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

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Theme | null) ?? "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);

    // Appliquer la couleur de fond custom si elle existe
    const savedBg = localStorage.getItem(BG_KEY);
    if (savedBg) {
      setBgColorState(savedBg);
      applyBgColor(savedBg);
    } else {
      setBgColorState(DEFAULT_BG[saved]);
    }
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(KEY, next);
    document.documentElement.setAttribute("data-theme", next);

    // Si pas de couleur custom, on suit le thème
    if (!localStorage.getItem(BG_KEY)) {
      setBgColorState(DEFAULT_BG[next]);
    }
  }

  function setBgColor(color: string) {
    setBgColorState(color);
    localStorage.setItem(BG_KEY, color);
    applyBgColor(color);
  }

  function resetBgColor() {
    setBgColorState(DEFAULT_BG[theme]);
    localStorage.removeItem(BG_KEY);
    clearBgColor();
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, bgColor, setBgColor, resetBgColor }}>
      {children}
    </ThemeContext.Provider>
  );
}
