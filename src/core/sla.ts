import { DEFAULT_SLA_MINUTES, SLA_AT_RISK_RATIO } from "../shared/constants.js";
import type { Priority, SlaStatus, Task } from "../shared/types.js";

export interface SlaEvaluation {
  status: SlaStatus;
  deadline: Date | null;
  minutesRemaining: number | null;
  consumedRatio: number | null;
}

const MS_PER_MINUTE = 60_000;

/**
 * Resolve the effective SLA window (minutes) for a task. An explicit positive
 * `slaMinutes` wins; otherwise we fall back to the per-priority default.
 */
export function effectiveSlaMinutes(
  slaMinutes: number | null,
  priority: Priority,
): number {
  if (slaMinutes !== null && Number.isFinite(slaMinutes) && slaMinutes > 0) {
    return slaMinutes;
  }
  return DEFAULT_SLA_MINUTES[priority];
}

/** Compute the SLA deadline given a creation time and window (minutes). */
export function slaDeadline(createdAt: Date, slaMinutes: number): Date {
  // Epoch-ms arithmetic so the deadline is exactly `slaMinutes` later regardless
  // of DST. Local-field math (setDate) would preserve wall-clock time across a DST
  // boundary and shift the real elapsed window by an hour (off-by-one breach).
  return new Date(createdAt.getTime() + slaMinutes * MS_PER_MINUTE);
}

/**
 * Evaluate a task's SLA status at a given moment.
 *
 * Rules:
 *  - Terminal tasks (`done`) have no live SLA → status "none".
 *  - A task with an invalid/unparseable createdAt yields "none".
 *  - consumedRatio = elapsed / window, clamped at 0 on the low end.
 *  - status: breached if now >= deadline (ratio >= 1), at_risk once the
 *    at-risk threshold is crossed, otherwise on_track.
 *  - minutesRemaining can be negative once breached.
 */
export function evaluateSla(task: Task, now: Date = new Date()): SlaEvaluation {
  if (task.state === "done") {
    return none();
  }

  const created = new Date(task.createdAt);
  const createdMs = created.getTime();
  if (Number.isNaN(createdMs)) {
    return none();
  }

  const windowMinutes = effectiveSlaMinutes(task.slaMinutes, task.priority);
  // A non-positive window is meaningless; treat as no SLA.
  if (!Number.isFinite(windowMinutes) || windowMinutes <= 0) {
    return none();
  }

  const deadline = slaDeadline(created, windowMinutes);
  const elapsedMs = now.getTime() - createdMs;
  const elapsedMinutes = elapsedMs / MS_PER_MINUTE;

  const consumedRatio = Math.max(0, elapsedMinutes / windowMinutes);
  const minutesRemaining = windowMinutes - elapsedMinutes;

  let status: SlaStatus;
  if (consumedRatio >= 1) {
    status = "breached";
  } else if (isAtRisk(consumedRatio)) {
    status = "at_risk";
  } else {
    status = "on_track";
  }

  return {
    status,
    deadline,
    minutesRemaining,
    consumedRatio,
  };
}

/**
 * Whether the consumed ratio crosses the at-risk threshold but has not yet
 * breached. A breached task (ratio >= 1) is no longer merely "at risk".
 */
export function isAtRisk(consumedRatio: number): boolean {
  return consumedRatio >= SLA_AT_RISK_RATIO && consumedRatio < 1;
}

function none(): SlaEvaluation {
  return {
    status: "none",
    deadline: null,
    minutesRemaining: null,
    consumedRatio: null,
  };
}
