import { describe, expect, it } from "vitest";

// FIREFUNC-BUG(4): FLAKY — this suite depends on wall-clock ordering (Date.now()
// resolution + sort stability on equal keys). It passes most runs but
// intermittently fails when two events land in the same millisecond. The fix is
// to make the ordering deterministic (monotonic sequence / tie-breaker), not to
// rely on the real clock.

interface ReportEntry {
  label: string;
  /** Captured from the wall clock at "creation" time. */
  at: number;
  seq: number;
}

/**
 * Simulate two activity entries recorded back-to-back. On fast machines both
 * Date.now() reads frequently return the SAME millisecond, so `at` ties.
 */
function recordPair(): ReportEntry[] {
  const a: ReportEntry = { label: "first", at: Date.now(), seq: 0 };
  // Busy-wait a SUB-millisecond, variable amount that straddles the ~1ms clock
  // tick. Sometimes the wall clock advances between the two reads, sometimes it
  // does not — this is what makes the timestamp-ordering assertion flaky.
  const spinUntil = performance.now() + Math.random();
  while (performance.now() < spinUntil) {
    /* spin */
  }
  const b: ReportEntry = { label: "second", at: Date.now(), seq: 1 };
  return [a, b];
}

describe("reports (flaky: wall-clock ordering dependent)", () => {
  it("orders activity entries by wall-clock timestamp", () => {
    const entries = recordPair();
    // Sort purely by timestamp. When timestamps tie (same ms), order is not
    // guaranteed, so the chronological assertion below intermittently fails.
    const ordered = [...entries].sort((x, y) => x.at - y.at);
    expect(ordered.map((e) => e.label)).toEqual(["first", "second"]);
  });

  it("two consecutive events have strictly increasing timestamps", () => {
    const [a, b] = recordPair();
    // Depends on the clock advancing by >=1ms between the two reads — flaky.
    expect(b!.at).toBeGreaterThan(a!.at);
  });
});
