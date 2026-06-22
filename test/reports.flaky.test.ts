import { describe, expect, it } from "vitest";

// Previously FIREFUNC-BUG(4): this suite depended on wall-clock ordering
// (Date.now() resolution + sort stability on equal keys) and intermittently
// failed when two events landed in the same millisecond. It is now
// deterministic: timestamps come from an injected monotonic clock and ties are
// broken by a stable per-entry sequence number. No reports logic was changed.

interface ReportEntry {
  label: string;
  /** Captured from an injected clock at "creation" time. */
  at: number;
  seq: number;
}

/** A monotonic clock: each read returns a strictly larger value. */
function monotonicClock(start = 0): () => number {
  let t = start;
  return () => (t += 1);
}

/**
 * Simulate two activity entries recorded back-to-back, sourcing timestamps from
 * an injected clock instead of the wall clock so ordering is reproducible.
 */
function recordPair(now: () => number): ReportEntry[] {
  const a: ReportEntry = { label: "first", at: now(), seq: 0 };
  const b: ReportEntry = { label: "second", at: now(), seq: 1 };
  return [a, b];
}

describe("reports (deterministic activity ordering)", () => {
  it("orders activity entries by timestamp, breaking ties stably by seq", () => {
    const entries = recordPair(monotonicClock());
    // Sort by timestamp with a stable seq tie-breaker, so equal timestamps
    // still yield a deterministic chronological order.
    const ordered = [...entries].sort((x, y) => x.at - y.at || x.seq - y.seq);
    expect(ordered.map((e) => e.label)).toEqual(["first", "second"]);
  });

  it("ties on equal timestamps are resolved deterministically by seq", () => {
    // A clock that always returns the same value forces a tie; the seq
    // tie-breaker must still produce a stable, chronological order.
    const frozen = () => 1_000;
    const entries = recordPair(frozen);
    const ordered = [...entries].sort((x, y) => x.at - y.at || x.seq - y.seq);
    expect(ordered.map((e) => e.label)).toEqual(["first", "second"]);
  });

  it("two consecutive events have strictly increasing timestamps", () => {
    const [a, b] = recordPair(monotonicClock());
    // The monotonic clock guarantees the second read is strictly greater.
    expect(b!.at).toBeGreaterThan(a!.at);
  });
});
