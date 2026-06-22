import { STATE_TRANSITIONS, TASK_STATES } from "../shared/constants.js";
import type { TaskState } from "../shared/types.js";

export interface TransitionResult {
  ok: boolean;
  from: TaskState;
  to: TaskState;
  reason?: string;
}

function isValidState(state: unknown): state is TaskState {
  return (
    typeof state === "string" && (TASK_STATES as readonly string[]).includes(state)
  );
}

/**
 * Whether a transition from one state to another is permitted.
 *
 * A move to the same state is always allowed (idempotent no-op). Any other
 * move must be explicitly listed in STATE_TRANSITIONS. Unknown states never
 * transition anywhere.
 */
export function canTransition(from: TaskState, to: TaskState): boolean {
  if (!isValidState(from) || !isValidState(to)) return false;
  if (from === to) return true;
  return STATE_TRANSITIONS[from].includes(to);
}

/**
 * Validate and describe a state transition. On failure the result carries a
 * human-readable `reason` explaining why the move is illegal.
 */
export function transition(from: TaskState, to: TaskState): TransitionResult {
  if (!isValidState(from)) {
    return { ok: false, from, to, reason: `unknown source state: ${String(from)}` };
  }
  if (!isValidState(to)) {
    return { ok: false, from, to, reason: `unknown target state: ${String(to)}` };
  }
  if (from === to) {
    return { ok: true, from, to };
  }
  if (STATE_TRANSITIONS[from].includes(to)) {
    return { ok: true, from, to };
  }
  return {
    ok: false,
    from,
    to,
    reason: `illegal transition ${from} -> ${to}`,
  };
}

/** All states reachable from a given state in one step (excluding itself). */
export function nextStates(from: TaskState): TaskState[] {
  if (!isValidState(from)) return [];
  return [...STATE_TRANSITIONS[from]];
}

/**
 * Whether a state is terminal: work is complete and there is no outbound
 * transition that represents further progress. `done` is terminal even though
 * it can be reopened to `todo`/`in_progress`.
 */
export function isTerminal(state: TaskState): boolean {
  return state === "done";
}
