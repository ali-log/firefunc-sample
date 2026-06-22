import React, { useState } from "react";
import { PRIORITIES, TASK_STATES } from "../shared/constants.js";
import { formatPriority, formatState } from "../core/format.js";
import { parseQuery, toTaskQuery } from "../core/query-dsl.js";
import { useTheme } from "./ThemeContext.js";
import type { TaskQuery } from "../shared/types.js";

export interface FilterBarProps {
  query: TaskQuery;
  onChange: (next: TaskQuery) => void;
}

/** Filter/search controls for the board, wired to the query DSL. */
export function FilterBar({ query, onChange }: FilterBarProps): React.JSX.Element {
  const { theme } = useTheme();
  const [dsl, setDsl] = useState("");

  const fieldStyle: React.CSSProperties = {
    background: theme.colors.surface,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius,
    padding: "6px 10px",
    fontSize: 13,
  };

  const applyDsl = (raw: string): void => {
    setDsl(raw);
    // Parse the DSL and merge the resulting structured filter with any
    // existing facet selections, letting the DSL win on overlap.
    const parsed = parseQuery(raw);
    const fromDsl = toTaskQuery(parsed);
    onChange({ ...query, ...fromDsl });
  };

  return (
    <div
      data-testid="filter-bar"
      style={{
        display: "flex",
        gap: 12,
        marginBottom: 16,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <input
        data-testid="filter-dsl"
        aria-label="Query DSL"
        placeholder='Query DSL, e.g. state:in_progress priority:high "needs review"'
        value={dsl}
        onChange={(e) => applyDsl(e.target.value)}
        style={{ ...fieldStyle, flex: 1, minWidth: 280 }}
      />
      <input
        data-testid="filter-search"
        aria-label="Search tasks"
        placeholder="Search tasks…"
        value={query.search ?? ""}
        onChange={(e) => onChange({ ...query, search: e.target.value || undefined })}
        style={fieldStyle}
      />
      <select
        data-testid="filter-state"
        aria-label="Filter by state"
        value={Array.isArray(query.state) ? "" : (query.state ?? "")}
        onChange={(e) =>
          onChange({ ...query, state: (e.target.value || undefined) as TaskQuery["state"] })
        }
        style={fieldStyle}
      >
        <option value="">All states</option>
        {TASK_STATES.map((s) => (
          <option key={s} value={s}>
            {formatState(s)}
          </option>
        ))}
      </select>
      <select
        data-testid="filter-priority"
        aria-label="Filter by priority"
        value={Array.isArray(query.priority) ? "" : (query.priority ?? "")}
        onChange={(e) =>
          onChange({ ...query, priority: (e.target.value || undefined) as TaskQuery["priority"] })
        }
        style={fieldStyle}
      >
        <option value="">All priorities</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {formatPriority(p)}
          </option>
        ))}
      </select>
    </div>
  );
}
