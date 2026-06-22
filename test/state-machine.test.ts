import { describe, expect, it } from "vitest";
import {
  canTransition,
  isTerminal,
  nextStates,
  transition,
} from "../src/core/state-machine.js";

describe("state-machine", () => {
  it("allows todo -> in_progress", () => {
    expect(canTransition("todo", "in_progress")).toBe(true);
  });

  it("treats a same-state move as valid", () => {
    expect(canTransition("done", "done")).toBe(true);
  });

  it("reports done as terminal", () => {
    expect(isTerminal("done")).toBe(true);
    expect(isTerminal("todo")).toBe(false);
  });

  it("returns next states as an array", () => {
    expect(Array.isArray(nextStates("todo"))).toBe(true);
  });

  it("describes a transition result", () => {
    const result = transition("todo", "in_progress");
    expect(result.ok).toBe(true);
    expect(result.from).toBe("todo");
    expect(result.to).toBe("in_progress");
  });
});
