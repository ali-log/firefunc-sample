import React from "react";
import { PRIORITIES, TASK_STATES } from "../shared/constants.js";
import { formatPriority, formatState } from "../core/format.js";
import { PRIORITY_COLORS, STATE_COLORS } from "./theme.js";
import { useTheme } from "./ThemeContext.js";
import type { ProjectReport, TaskState } from "../shared/types.js";

export interface ReportDashboardProps {
  report?: ProjectReport;
}

interface BarDatum {
  label: string;
  value: number;
  color: string;
}

/** Reporting dashboard showing project health metrics and a simple bar chart. */
export function ReportDashboard({ report }: ReportDashboardProps): React.JSX.Element {
  const { theme } = useTheme();

  if (!report) {
    return (
      <p data-testid="report-empty" style={{ color: theme.colors.muted }}>
        No report data yet.
      </p>
    );
  }

  const stateBars: BarDatum[] = TASK_STATES.map((s) => ({
    label: formatState(s),
    value: report.byState[s as TaskState] ?? 0,
    color: STATE_COLORS[s],
  }));

  const priorityBars: BarDatum[] = PRIORITIES.map((p) => ({
    label: formatPriority(p),
    value: report.byPriority[p] ?? 0,
    color: PRIORITY_COLORS[p],
  }));

  const stats: Array<{ label: string; value: string | number }> = [
    { label: "Total tasks", value: report.totalTasks },
    { label: "Overdue", value: report.overdue },
    { label: "SLA breached", value: report.slaBreached },
    { label: "Completed this week", value: report.completedThisWeek },
    {
      label: "Avg cycle time",
      value: report.avgCycleTimeHours == null ? "—" : `${report.avgCycleTimeHours.toFixed(1)}h`,
    },
  ];

  return (
    <div data-testid="report-dashboard">
      <h2 style={{ marginTop: 0 }}>Project Report</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius,
              padding: 16,
            }}
          >
            <div style={{ color: theme.colors.muted, fontSize: 12 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <BarChart title="Tasks by state" data={stateBars} />
      <BarChart title="Tasks by priority" data={priorityBars} />
    </div>
  );
}

function BarChart({ title, data }: { title: string; data: BarDatum[] }): React.JSX.Element {
  const { theme } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <section
      data-testid="bar-chart"
      style={{
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <h3 style={{ marginTop: 0, fontSize: 14 }}>{title}</h3>
      <div style={{ display: "grid", gap: 8 }}>
        {data.map((d) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                width: 90,
                fontSize: 12,
                color: theme.colors.muted,
                textAlign: "right",
              }}
            >
              {d.label}
            </span>
            <div style={{ flex: 1, background: theme.colors.bg, borderRadius: 4, height: 18 }}>
              <div
                role="img"
                aria-label={`${d.label}: ${d.value}`}
                style={{
                  width: `${(d.value / max) * 100}%`,
                  minWidth: d.value > 0 ? 4 : 0,
                  background: d.color,
                  height: "100%",
                  borderRadius: 4,
                  transition: "width 200ms ease",
                }}
              />
            </div>
            <span style={{ width: 28, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
