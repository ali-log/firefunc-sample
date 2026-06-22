import React, { useState } from "react";
import { useTheme } from "./ThemeContext.js";

/** Workspace settings panel, including the theme toggle. */
export function Settings(): React.JSX.Element {
  const { theme, mode, setMode } = useTheme();
  const [workspace, setWorkspace] = useState("Acme Engineering");
  const [emailDigest, setEmailDigest] = useState(true);

  const card: React.CSSProperties = {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius,
    padding: 16,
    marginBottom: 16,
    maxWidth: 520,
  };

  return (
    <div data-testid="settings">
      <h2 style={{ marginTop: 0 }}>Settings</h2>

      <section style={card}>
        <h3 style={{ marginTop: 0, fontSize: 14 }}>Appearance</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ flex: 1 }}>Theme</span>
          <ThemeToggle mode={mode} onToggle={() => setMode(mode === "dark" ? "light" : "dark")} />
        </label>
      </section>

      <section style={card}>
        <h3 style={{ marginTop: 0, fontSize: 14 }}>Workspace</h3>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: theme.colors.muted, fontSize: 12 }}>Workspace name</span>
          <input
            data-testid="settings-workspace"
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            style={{
              background: theme.colors.bg,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius,
              padding: "6px 10px",
              fontSize: 13,
            }}
          />
        </label>
      </section>

      <section style={card}>
        <h3 style={{ marginTop: 0, fontSize: 14 }}>Notifications</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            data-testid="settings-digest"
            type="checkbox"
            checked={emailDigest}
            onChange={(e) => setEmailDigest(e.target.checked)}
          />
          <span>Send me a weekly email digest</span>
        </label>
      </section>
    </div>
  );
}

/** Standalone theme toggle, also reusable in the header. */
export function ThemeToggle({
  mode,
  onToggle,
}: {
  mode: "dark" | "light";
  onToggle: () => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  return (
    <button
      data-testid="theme-toggle"
      aria-label="Toggle theme"
      aria-pressed={mode === "light"}
      onClick={onToggle}
      style={{
        background: theme.colors.bg,
        color: theme.colors.text,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 999,
        padding: "6px 12px",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {mode === "dark" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}
