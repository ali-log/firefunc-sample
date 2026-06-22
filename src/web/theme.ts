import type { Priority, TaskState } from "../shared/types.js";

export type ThemeMode = "dark" | "light";

export interface Theme {
  colors: {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
  };
  radius: string;
  font: string;
}

export const darkTheme: Theme = {
  colors: {
    bg: "#0f1115",
    surface: "#181b21",
    text: "#e6e8eb",
    muted: "#8b909a",
    border: "#272b33",
    accent: "#ff6a3d",
  },
  radius: "8px",
  font: "system-ui, -apple-system, sans-serif",
};

export const lightTheme: Theme = {
  colors: {
    bg: "#f6f7f9",
    surface: "#ffffff",
    text: "#1b1e24",
    muted: "#6b7280",
    border: "#dfe3e8",
    accent: "#ff6a3d",
  },
  radius: "8px",
  font: "system-ui, -apple-system, sans-serif",
};

/** Default theme (dark). Preserved export for backward compatibility. */
export const theme: Theme = darkTheme;

/** Resolve a Theme object from a mode. */
export function themeForMode(mode: ThemeMode): Theme {
  return mode === "light" ? lightTheme : darkTheme;
}

export const STATE_COLORS: Record<TaskState, string> = {
  todo: "#8b909a",
  in_progress: "#3d82ff",
  blocked: "#ff5b5b",
  done: "#39c46a",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: "#8b909a",
  medium: "#3d82ff",
  high: "#ffab3d",
  urgent: "#ff5b5b",
};
