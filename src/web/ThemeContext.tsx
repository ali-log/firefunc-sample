import React, { createContext, useContext, useMemo, useState } from "react";
import { themeForMode } from "./theme.js";
import type { Theme, ThemeMode } from "./theme.js";

export interface ThemeContextValue {
  mode: ThemeMode;
  theme: Theme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "firefunc.theme";

function initialMode(): ThemeMode {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  }
  return "dark";
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);

  const setMode = (next: ThemeMode): void => {
    setModeState(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      theme: themeForMode(mode),
      setMode,
      toggle: () => setMode(mode === "dark" ? "light" : "dark"),
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the active theme + controls. Falls back to dark theme outside a provider. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return {
    mode: "dark",
    theme: themeForMode("dark"),
    setMode: () => {},
    toggle: () => {},
  };
}
