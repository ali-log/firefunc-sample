import { describe, expect, it } from "vitest";
import {
  canTransition,
  isTerminal,
  nextStates,
  transition,
} from "../src/core/state-machine.js";
import { STATE_TRANSITIONS, TASK_STATES } from "../src/shared/constants.js";
import type { TaskState } from "../src/shared/types.js";

describe("state-machine: canTransition", () => {
  it("allows every transition declared in STATE_TRANSITIONS", () => {
    for (const from of TASK_STATES) {
      for (const to of STATE_TRANSITIONS[from]) {
        expect(canTransition(from, to)).toBe(true);
      }
    }
  });

  it("treats same-state as a valid (idempotent) move for every state", () => {
    for (const s of TASK_STATES) {
      expect(canTransition(s, s)).toBe(true);
    }
  });

  it("rejects transitions not in the table", () => {
    // blocked may only go to todo/in_progress.
    expect(canTransition("blocked", "done")).toBe(false);
  });

  it("rejects unknown source or target states", () => {
    expect(canTransition("nope" as TaskState, "todo")).toBe(false);
    expect(canTransition("todo", "nope" as TaskState)).toBe(false);
    expect(canTransition("x" as TaskState, "y" as TaskState)).toBe(false);
  });
});

describe("state-machine: transition", () => {
  it("returns ok with no reason on a legal move", () => {
    const r = transition("todo", "in_progress");
    expect(r).toEqual({ ok: true, from: "todo", to: "in_progress" });
    expect(r.reason).toBeUndefined();
  });

  it("returns ok for same-state moves", () => {
    expect(transition("done", "done").ok).toBe(true);
  });

  it("returns a descriptive reason on an illegal move", () => {
    const r = transition("blocked", "done");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/illegal transition blocked -> done/);
  });

  it("flags an unknown source state", () => {
    const r = transition("ghost" as TaskState, "todo");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/unknown source state/);
  });

  it("flags an unknown target state", () => {
    const r = transition("todo", "ghost" as TaskState);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/unknown target state/);
  });

  it("agrees with canTransition for all state pairs", () => {
    for (const from of TASK_STATES) {
      for (const to of TASK_STATES) {
        expect(transition(from, to).ok).toBe(canTransition(from, to));
      }
    }
  });
});

describe("state-machine: nextStates", () => {
  it("returns a fresh copy (mutating the result does not leak)", () => {
    const a = nextStates("blocked"); // ["todo", "in_progress"]
    a.push("done");
    expect(nextStates("blocked")).not.toContain("done"); // unchanged
  });

  it("returns [] for an unknown state", () => {
    expect(nextStates("???" as TaskState)).toEqual([]);
  });
});

describe("state-machine: isTerminal", () => {
  it("only done is terminal", () => {
    expect(isTerminal("done")).toBe(true);
    for (const s of ["todo", "in_progress", "blocked"] as TaskState[]) {
      expect(isTerminal(s)).toBe(false);
    }
  });
});
