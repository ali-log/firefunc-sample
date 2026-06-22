import type { Priority, TaskState, UserRole } from "./types.js";

export const TASK_STATES: readonly TaskState[] = [
  "todo",
  "in_progress",
  "blocked",
  "done",
] as const;

export const PRIORITIES: readonly Priority[] = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const USER_ROLES: readonly UserRole[] = [
  "owner",
  "admin",
  "member",
  "viewer",
] as const;

// Higher weight = more important. Used by priority ranking.
export const PRIORITY_WEIGHT: Record<Priority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

// Allowed state transitions for the task state machine.
export const STATE_TRANSITIONS: Record<TaskState, readonly TaskState[]> = {
  todo: ["in_progress", "blocked", "done"],
  in_progress: ["todo", "blocked", "done"],
  blocked: ["todo", "in_progress"],
  done: ["todo", "in_progress"],
};

export const DEFAULT_PAGE_LIMIT = 75;
export const MAX_PAGE_LIMIT = 200;

// Default SLA windows (minutes) per priority, used when a task has no explicit SLA.
export const DEFAULT_SLA_MINUTES: Record<Priority, number> = {
  low: 60 * 24 * 14,
  medium: 60 * 24 * 7,
  high: 60 * 24 * 2,
  urgent: 60 * 8,
};

export const SLA_AT_RISK_RATIO = 0.8; // fraction of window consumed → at_risk

export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;
