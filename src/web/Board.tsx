import React, { useState } from "react";
import { TASK_STATES } from "../shared/constants.js";
import { formatPriority, formatState } from "../core/format.js";
import { canTransition } from "../core/state-machine.js";
import { PRIORITY_COLORS, STATE_COLORS } from "./theme.js";
import { useTheme } from "./ThemeContext.js";
import type { Task, TaskQuery, TaskState } from "../shared/types.js";

export interface BoardProps {
  query: TaskQuery;
  tasks?: Task[];
  loading?: boolean;
  error?: string | null;
  /** Invoked when a card is dropped onto a different, reachable column. */
  onTaskMove?: (taskId: string, to: TaskState) => void;
}

/** Kanban board grouping tasks into columns by state, with drag-between-columns. */
export function Board({
  tasks = [],
  loading = false,
  error = null,
  onTaskMove,
}: BoardProps): React.JSX.Element {
  const { theme } = useTheme();
  const [dragging, setDragging] = useState<Task | null>(null);
  const [over, setOver] = useState<TaskState | null>(null);

  if (loading) {
    return (
      <div data-testid="board-loading" style={{ color: theme.colors.muted, padding: 24 }}>
        Loading tasks…
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="board-error"
        role="alert"
        style={{
          color: STATE_COLORS.blocked,
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius,
          padding: 16,
        }}
      >
        Failed to load tasks: {error}
      </div>
    );
  }

  const handleDrop = (to: TaskState): void => {
    setOver(null);
    const task = dragging;
    setDragging(null);
    if (!task || task.state === to) return;
    if (!canTransition(task.state, to)) return;
    onTaskMove?.(task.id, to);
  };

  return (
    <div data-testid="board" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      {TASK_STATES.map((state) => {
        const column = tasks.filter((t) => t.state === state);
        // FIREFUNC-BUG(2): pct badge divides by tasks.length with no zero-guard → 0/0=NaN (and n/0=Infinity) when a project has 0 tasks.
        const pct = Math.round((column.length / tasks.length) * 100);
        const droppable = dragging != null && canTransition(dragging.state, state);
        const isOver = over === state && droppable;
        return (
          <section
            key={state}
            data-testid={`column-${state}`}
            data-count={column.length}
            onDragOver={(e) => {
              if (droppable) {
                e.preventDefault();
                setOver(state);
              }
            }}
            onDragLeave={() => setOver((s) => (s === state ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(state);
            }}
            style={{
              flex: 1,
              minWidth: 200,
              background: theme.colors.surface,
              border: `1px solid ${isOver ? theme.colors.accent : theme.colors.border}`,
              borderRadius: theme.radius,
              padding: 12,
              transition: "border-color 120ms ease",
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3 style={{ color: STATE_COLORS[state], margin: 0, fontSize: 14 }}>
                {formatState(state)}
              </h3>
              <span
                data-testid={`count-${state}`}
                style={{
                  background: theme.colors.bg,
                  color: theme.colors.muted,
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontSize: 12,
                  minWidth: 20,
                  textAlign: "center",
                }}
              >
                {column.length}
              </span>
              <span
                data-testid={`pct-${state}`}
                style={{ color: theme.colors.muted, fontSize: 11, marginLeft: 6 }}
              >
                {pct}%
              </span>
            </header>

            {column.length === 0 ? (
              <p
                data-testid={`empty-${state}`}
                style={{ color: theme.colors.muted, fontSize: 12, margin: "8px 0" }}
              >
                No tasks
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                {column.map((t) => (
                  <li
                    key={t.id}
                    data-testid={`card-${t.id}`}
                    draggable
                    onDragStart={() => setDragging(t)}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    style={{
                      background: theme.colors.bg,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radius,
                      padding: 10,
                      cursor: "grab",
                      opacity: dragging?.id === t.id ? 0.5 : 1,
                    }}
                  >
                    <div style={{ fontSize: 13, marginBottom: 6 }}>{t.title}</div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: PRIORITY_COLORS[t.priority],
                          border: `1px solid ${PRIORITY_COLORS[t.priority]}`,
                          borderRadius: 4,
                          padding: "1px 6px",
                        }}
                      >
                        {formatPriority(t.priority)}
                      </span>
                      {t.labels.map((label) => (
                        <span
                          key={label}
                          style={{
                            fontSize: 11,
                            color: theme.colors.muted,
                            background: theme.colors.surface,
                            borderRadius: 4,
                            padding: "1px 6px",
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
