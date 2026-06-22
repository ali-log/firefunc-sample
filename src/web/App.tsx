import React, { useCallback, useState } from "react";
import { Board } from "./Board.js";
import { FilterBar } from "./FilterBar.js";
import { ReportDashboard } from "./ReportDashboard.js";
import { Settings, ThemeToggle } from "./Settings.js";
import { ThemeProvider, useTheme } from "./ThemeContext.js";
import { fetchReport, fetchTasks, useAsync } from "./data.js";
import type { Task, TaskQuery, TaskState } from "../shared/types.js";

type View = "board" | "reports" | "settings";

/** Root component: wraps everything in the theme provider. */
export function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell(): React.JSX.Element {
  const { theme, mode, toggle } = useTheme();
  const [view, setView] = useState<View>("board");
  const [query, setQuery] = useState<TaskQuery>({});

  // Local overrides applied on drag-move, so the UI updates optimistically
  // without waiting for a re-fetch.
  const [moves, setMoves] = useState<Record<string, TaskState>>({});

  const tasksState = useAsync<Task[]>(() => fetchTasks(query), [JSON.stringify(query)]);
  const reportState = useAsync(() => fetchReport(query.projectId), [query.projectId]);

  const tasks = (tasksState.data ?? []).map((t) =>
    moves[t.id] ? { ...t, state: moves[t.id]! } : t,
  );

  const handleTaskMove = useCallback((taskId: string, to: TaskState) => {
    setMoves((m) => ({ ...m, [taskId]: to }));
  }, []);

  const navBtn = (target: View, label: string): React.JSX.Element => (
    <button
      data-testid={`nav-${target}`}
      onClick={() => setView(target)}
      style={{
        background: view === target ? theme.colors.accent : "transparent",
        color: view === target ? "#fff" : theme.colors.text,
        border: `1px solid ${view === target ? theme.colors.accent : theme.colors.border}`,
        borderRadius: theme.radius,
        padding: "4px 12px",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      data-testid="app"
      style={{
        background: theme.colors.bg,
        color: theme.colors.text,
        fontFamily: theme.font,
        minHeight: "100vh",
      }}
    >
      <header
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${theme.colors.border}`,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <strong style={{ color: theme.colors.accent }}>FireFunc Tracker</strong>
        <nav style={{ display: "inline-flex", gap: 8 }}>
          {navBtn("board", "Board")}
          {navBtn("reports", "Reports")}
          {navBtn("settings", "Settings")}
        </nav>
        <div style={{ marginLeft: "auto" }}>
          <ThemeToggle mode={mode} onToggle={toggle} />
        </div>
      </header>

      <main style={{ padding: 16 }}>
        {view === "board" && (
          <>
            <FilterBar query={query} onChange={setQuery} />
            {!tasksState.loading && !tasksState.error && tasks.length === 0 ? (
              <div
                data-testid="board-empty"
                style={{
                  color: theme.colors.muted,
                  background: theme.colors.surface,
                  border: `1px dashed ${theme.colors.border}`,
                  borderRadius: theme.radius,
                  padding: 32,
                  textAlign: "center",
                }}
              >
                No tasks match your filters.
              </div>
            ) : (
              <Board
                query={query}
                tasks={tasks}
                loading={tasksState.loading}
                error={tasksState.error}
                onTaskMove={handleTaskMove}
              />
            )}
          </>
        )}

        {view === "reports" &&
          (reportState.loading ? (
            <p data-testid="report-loading" style={{ color: theme.colors.muted }}>
              Loading report…
            </p>
          ) : reportState.error ? (
            <p data-testid="report-error" role="alert" style={{ color: "#ff5b5b" }}>
              Failed to load report: {reportState.error}
            </p>
          ) : (
            <ReportDashboard report={reportState.data ?? undefined} />
          ))}

        {view === "settings" && <Settings />}
      </main>
    </div>
  );
}
