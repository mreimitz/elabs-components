import { describe, expect, it } from "vitest";

import { discoverGraph } from "./discover-graph";
import { DURATION_SAMPLE_CAP } from "./duration-stats";
import { asNormalizedLog, normalizeLog } from "./event-log";
import { generateSyntheticLog } from "./fixtures/synthetic-log";
import fixture from "./fixtures/order-to-cash-small.json";
import type { ActivityStats, EventLog, TransitionStats } from "./types";

const orderToCash = fixture as EventLog;

/**
 * The five traces in `order-to-cash-small.json`, restated here so the expected table
 * below can be read against them without opening the fixture:
 *
 *   case-1  Create Order · Check Credit · Approve Order · Ship Order · Send Invoice · Receive Payment
 *   case-2  Create Order · Check Credit · Approve Order · Ship Order · Send Invoice · Receive Payment
 *   case-3  Create Order · Check Credit · Reject Order
 *   case-4  Create Order · Check Credit · Amend Order · Check Credit · Approve Order · Ship Order ·
 *           Send Invoice · Receive Payment
 *   case-5  Create Order · Check Credit · Approve Order · Send Invoice · Ship Order · Receive Payment
 *
 * 29 events, 5 cases, 4 distinct sequences. Every number below was counted from those
 * five lines by hand, not read off the implementation.
 */
type ActivityRow = Omit<ActivityStats, "duration">;
type TransitionRow = Omit<TransitionStats, "duration">;

const stripDuration = (graph: { activities: ActivityStats[]; transitions: TransitionStats[] }) => ({
  activities: graph.activities.map(({ duration: _duration, ...row }) => row) as ActivityRow[],
  transitions: graph.transitions.map(({ duration: _duration, ...row }) => row) as TransitionRow[],
});

describe("discoverGraph on the 5-case order-to-cash fixture", () => {
  it("reproduces the hand-computed activity table", () => {
    // Ordered busiest-first, ties broken by name.
    expect(stripDuration(discoverGraph(orderToCash)).activities).toEqual([
      {
        id: "Check Credit",
        label: "Check Credit",
        instances: 6,
        cases: 5,
        isStart: false,
        isEnd: false,
      },
      {
        id: "Create Order",
        label: "Create Order",
        instances: 5,
        cases: 5,
        isStart: true,
        isEnd: false,
      },
      {
        id: "Approve Order",
        label: "Approve Order",
        instances: 4,
        cases: 4,
        isStart: false,
        isEnd: false,
      },
      {
        id: "Receive Payment",
        label: "Receive Payment",
        instances: 4,
        cases: 4,
        isStart: false,
        isEnd: true,
      },
      {
        id: "Send Invoice",
        label: "Send Invoice",
        instances: 4,
        cases: 4,
        isStart: false,
        isEnd: false,
      },
      {
        id: "Ship Order",
        label: "Ship Order",
        instances: 4,
        cases: 4,
        isStart: false,
        isEnd: false,
      },
      {
        id: "Amend Order",
        label: "Amend Order",
        instances: 1,
        cases: 1,
        isStart: false,
        isEnd: false,
      },
      {
        id: "Reject Order",
        label: "Reject Order",
        instances: 1,
        cases: 1,
        isStart: false,
        isEnd: true,
      },
    ]);
  });

  it("reproduces the hand-computed transition table", () => {
    // Ordered by count descending, then source, then target.
    expect(stripDuration(discoverGraph(orderToCash)).transitions).toEqual([
      {
        source: "Create Order",
        target: "Check Credit",
        count: 5,
        caseCount: 5,
        isSelfLoop: false,
        isBackEdge: false,
      },
      {
        source: "Check Credit",
        target: "Approve Order",
        count: 4,
        caseCount: 4,
        isSelfLoop: false,
        isBackEdge: false,
      },
      {
        source: "Approve Order",
        target: "Ship Order",
        count: 3,
        caseCount: 3,
        isSelfLoop: false,
        isBackEdge: false,
      },
      {
        source: "Send Invoice",
        target: "Receive Payment",
        count: 3,
        caseCount: 3,
        isSelfLoop: false,
        isBackEdge: false,
      },
      {
        source: "Ship Order",
        target: "Send Invoice",
        count: 3,
        caseCount: 3,
        isSelfLoop: false,
        isBackEdge: false,
      },
      {
        source: "Amend Order",
        target: "Check Credit",
        count: 1,
        caseCount: 1,
        isSelfLoop: false,
        isBackEdge: false,
      },
      {
        source: "Approve Order",
        target: "Send Invoice",
        count: 1,
        caseCount: 1,
        isSelfLoop: false,
        isBackEdge: false,
      },
      {
        source: "Check Credit",
        target: "Amend Order",
        count: 1,
        caseCount: 1,
        isSelfLoop: false,
        isBackEdge: false,
      },
      {
        source: "Check Credit",
        target: "Reject Order",
        count: 1,
        caseCount: 1,
        isSelfLoop: false,
        isBackEdge: false,
      },
      {
        source: "Send Invoice",
        target: "Ship Order",
        count: 1,
        caseCount: 1,
        isSelfLoop: false,
        isBackEdge: false,
      },
      {
        source: "Ship Order",
        target: "Receive Payment",
        count: 1,
        caseCount: 1,
        isSelfLoop: false,
        isBackEdge: false,
      },
    ]);
  });

  it("reproduces the hand-computed start/end tallies and totals", () => {
    const graph = discoverGraph(orderToCash);
    expect(graph.startActivities).toEqual({ "Create Order": 5 });
    expect(graph.endActivities).toEqual({ "Receive Payment": 4, "Reject Order": 1 });
    expect(graph.totals).toEqual({ cases: 5, events: 29, variants: 4 });
    // The two tallies must add up to the case count, once each.
    const sum = (record: Record<string, number>): number =>
      Object.values(record).reduce((total, value) => total + value, 0);
    expect(sum(graph.startActivities)).toBe(5);
    expect(sum(graph.endActivities)).toBe(5);
  });

  it("reproduces the hand-computed idle-time statistics of the busiest edge", () => {
    // Create Order → Check Credit: 60 min in cases 1-4, 120 min in case 5.
    // sorted [3.6e6, 3.6e6, 3.6e6, 3.6e6, 7.2e6] → sum 21.6e6, mean 4.32e6, median 3.6e6,
    // p90 at pos 0.9 * 4 = 3.6 → 3.6e6 + 0.6 * 3.6e6 = 5.76e6, trim floor(0.5) = 0.
    const edge = discoverGraph(orderToCash).transitions[0];
    expect(edge?.duration).toEqual({
      min: 3_600_000,
      max: 7_200_000,
      mean: 4_320_000,
      median: 3_600_000,
      p90: 5_760_000,
      sum: 21_600_000,
      trimmedMean: 4_320_000,
    });
  });

  it("reports zero activity durations, because every fixture event is atomic", () => {
    for (const activity of discoverGraph(orderToCash).activities) {
      expect(activity.duration.sum).toBe(0);
      expect(activity.duration.max).toBe(0);
    }
  });

  it("accepts an already-normalized log and answers identically", () => {
    expect(discoverGraph(normalizeLog(orderToCash))).toEqual(discoverGraph(orderToCash));
  });

  it("is deterministic — two runs over one log are deeply equal", () => {
    expect(discoverGraph(orderToCash)).toEqual(discoverGraph(orderToCash));
  });
});

describe("discoverGraph determinism past the duration-sample cap (RM-052 round 2, #227, F5)", () => {
  // The determinism test above runs on the 5-case order-to-cash fixture (29 events), so no
  // activity or edge ever offers more than a handful of duration samples — `DurationSampler`
  // fills its reservoir and stops, and its seeded `mulberry32` PRNG is never consulted. That
  // makes the assertion real but VACUOUS as a lock on the reservoir-REPLACEMENT branch (the
  // one `add()` takes once `this.reservoir.length === this.capacity`, which is where a
  // clock-seeded or otherwise non-deterministic RNG would actually show up as flaky output).
  //
  // "Create Order" opens every trace exactly once and unconditionally (see `buildTrace` in
  // `./fixtures/synthetic-log.ts` — it is pushed before any of the random branches run), so
  // at `cases: 5_000` its activity, and the "Create Order" → "Check Credit" edge that always
  // follows it, each accumulate exactly 5,000 duration samples — comfortably past
  // `DURATION_SAMPLE_CAP` (4,096) — forcing the replacement branch to run on every one of the
  // 904 samples past the cap, not merely on the ones that fill it.
  const bigLog = generateSyntheticLog({ cases: 5_000, seed: 11 });

  it("proves the reservoir-replacement branch actually ran, by observed sample count — not log size", () => {
    // Non-vacuity check, corrected (RM-052 round 3, #227, G3): `instances`/`count` below
    // are the number of EVENTS/TRANSITIONS `discoverGraph` walked for that activity/edge —
    // not a read of `DurationSampler`'s own state. They only stand in for "samples offered
    // to the sampler" because every walked event/transition unconditionally calls
    // `duration.add(...)` (see `discover-graph.ts`) with a FINITE duration. Assert that
    // premise directly: every case in `bigLog`, once normalized the same way
    // `discoverGraph` normalizes its input, has a finite `duration`/`start`/`end` on every
    // event — so no event is silently dropped by `DurationSampler.add`'s
    // `Number.isFinite` guard, and the instances/count tallies below really do equal the
    // sampler's offered-sample count.
    for (const normalizedCase of asNormalizedLog(bigLog).cases) {
      for (const event of normalizedCase.events) {
        expect(Number.isFinite(event.duration)).toBe(true);
        expect(Number.isFinite(event.start)).toBe(true);
        expect(Number.isFinite(event.end)).toBe(true);
      }
    }

    const graph = discoverGraph(bigLog);
    const createOrder = graph.activities.find((activity) => activity.id === "Create Order");
    expect(createOrder?.instances).toBeGreaterThan(DURATION_SAMPLE_CAP);

    const firstEdge = graph.transitions.find(
      (edge) => edge.source === "Create Order" && edge.target === "Check Credit",
    );
    expect(firstEdge?.count).toBeGreaterThan(DURATION_SAMPLE_CAP);
  });

  it("is deterministic even once the PRNG reservoir-replacement branch is exercised", () => {
    // Two independent `discoverGraph` calls over the same log, each building its own fresh
    // `DurationSampler`s from scratch (seeded from a per-graph creation counter, never from
    // a clock — see the `nextSeed` comment in `discover-graph.ts`). If that seeding, or the
    // PRNG it feeds, ever became non-deterministic, this is where it would show up: past the
    // cap, every kept/discarded decision depends on `this.random()`, so a diverging seed
    // would diverge the retained reservoir, and with it `median`/`p90`/`trimmedMean`.
    expect(discoverGraph(bigLog)).toEqual(discoverGraph(bigLog));
  });
});

describe("discoverGraph edge semantics", () => {
  it("marks a repeated activity as a self-loop", () => {
    const log: EventLog = {
      events: [
        { caseId: "c1", activity: "Pick", timestamp: 0 },
        { caseId: "c1", activity: "Pick", timestamp: 1000 },
      ],
    };
    const [edge] = discoverGraph(log).transitions;
    expect(edge).toMatchObject({ source: "Pick", target: "Pick", count: 1, isSelfLoop: true });
  });

  it("never sets isBackEdge — discovery does not lay out", () => {
    const graph = discoverGraph(generateSyntheticLog({ cases: 200, seed: 3 }));
    expect(graph.transitions.every((edge) => edge.isBackEdge === false)).toBe(true);
  });

  it("counts a repeated edge once per case in caseCount but every time in count", () => {
    const log: EventLog = {
      events: [
        { caseId: "c1", activity: "A", timestamp: 0 },
        { caseId: "c1", activity: "B", timestamp: 1 },
        { caseId: "c1", activity: "A", timestamp: 2 },
        { caseId: "c1", activity: "B", timestamp: 3 },
      ],
    };
    const edge = discoverGraph(log).transitions.find((e) => e.source === "A" && e.target === "B");
    expect(edge).toMatchObject({ count: 2, caseCount: 1 });
    const activity = discoverGraph(log).activities.find((a) => a.id === "A");
    expect(activity).toMatchObject({ instances: 2, cases: 1 });
  });

  it("measures idle time by default and inter-start time on request", () => {
    const log: EventLog = {
      events: [
        { caseId: "c1", activity: "A", startTimestamp: 0, timestamp: 1000 },
        { caseId: "c1", activity: "B", startTimestamp: 5000, timestamp: 6000 },
      ],
    };
    expect(discoverGraph(log).transitions[0]?.duration.sum).toBe(4000); // 5000 - 1000
    expect(discoverGraph(log, { flowTime: "inter_start_time" }).transitions[0]?.duration.sum).toBe(
      5000, // 5000 - 0
    );
  });

  it("answers an empty log with an empty graph", () => {
    expect(discoverGraph({ events: [] })).toEqual({
      activities: [],
      transitions: [],
      startActivities: {},
      endActivities: {},
      totals: { cases: 0, events: 0, variants: 0 },
    });
  });

  it("gives a single-event case a start, an end and no transition", () => {
    const graph = discoverGraph({ events: [{ caseId: "c1", activity: "Only", timestamp: 0 }] });
    expect(graph.transitions).toEqual([]);
    expect(graph.activities[0]).toMatchObject({ id: "Only", isStart: true, isEnd: true });
  });
});

describe("discoverGraph performance", () => {
  it("discovers a 13 000-case synthetic log well inside the budget", () => {
    const log = generateSyntheticLog({ cases: 13_000, seed: 1 });
    // Warm the JIT so the measurement is of steady-state work, not of first-call
    // compilation — otherwise the number swings by an order of magnitude on CI.
    discoverGraph(generateSyntheticLog({ cases: 200, seed: 1 }));

    const started = performance.now();
    const graph = discoverGraph(log);
    const elapsed = performance.now() - started;

    expect(graph.totals.cases).toBe(13_000);
    expect(graph.totals.events).toBeGreaterThan(100_000);
    // The design budget is 300 ms; the assertion carries 5x headroom so a loaded CI
    // runner cannot turn a real regression gate into a flaky wall-clock test.
    expect(elapsed).toBeLessThan(1500);
  });
});
