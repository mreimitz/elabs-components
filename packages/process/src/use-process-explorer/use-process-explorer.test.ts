import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asNormalizedLog } from "../core/event-log";
import { detectRework } from "../core/detect-rework";
import { discoverGraph } from "../core/discover-graph";
import { durationStats } from "../core/duration-stats";
import { extractVariants } from "../core/extract-variants";
import { handleProcessRequest, type ProcessWorkerRequest } from "../core/worker/process-worker";
import type { ProcessWorkerLike } from "../core/worker/create-process-worker";
import type { EventLog } from "../core/types";
import fixture from "../core/fixtures/order-to-cash-small.json";
import { useProcessExplorer } from "./use-process-explorer";

// Spies on the REAL `discoverGraph`, so every existing `discoverGraph(orderToCash)` call
// used elsewhere in this file to compute an "expected" value keeps its real behaviour —
// this only makes the call COUNTABLE for the G1 lock below (#227).
vi.mock("../core/discover-graph", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../core/discover-graph")>();
  return { ...actual, discoverGraph: vi.fn(actual.discoverGraph) };
});

afterEach(cleanup);

const orderToCash = fixture as EventLog;

/**
 * Minimal `ProcessWorkerLike` — answers on a LATER microtask (never synchronously), so a
 * test that races two requests exercises real interleaving rather than an accident of
 * call order. Mirrors `create-process-worker.test.ts`'s own `FakeWorker`, kept local and
 * smaller: this suite only needs the happy path, not its degrade branches (those are
 * RM-050's to prove).
 */
class FakeWorker implements ProcessWorkerLike {
  private readonly listeners: ((event: unknown) => void)[] = [];

  postMessage(message: unknown): void {
    const response = handleProcessRequest(message as ProcessWorkerRequest);
    void Promise.resolve().then(() => {
      for (const listener of this.listeners) listener({ data: response });
    });
  }

  terminate(): void {}

  addEventListener(
    type: "message" | "error" | "messageerror",
    listener: (event: unknown) => void,
  ): void {
    if (type === "message") this.listeners.push(listener);
  }
}

describe("useProcessExplorer — defaults", () => {
  it("starts at identity abstraction, the default metric, no selection and no intents", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    expect(result.current.abstraction).toEqual({
      activities: 1,
      paths: 1,
      invert: false,
      keepConnected: true,
    });
    expect(result.current.metric).toEqual({ node: "absolute", edge: "absolute" });
    expect(result.current.selection).toBeNull();
    expect(result.current.intents).toEqual([]);
    expect(result.current.loading).toBe(false);
    // Identity abstraction hides nothing.
    expect(result.current.hiddenCounts).toEqual({ activities: 0, paths: 0 });
    expect(result.current.graph.activities).toHaveLength(
      discoverGraph(orderToCash).activities.length,
    );
  });
});

describe("useProcessExplorer — exactly one discovery when no intent is active (RM-052 round 3, #227, G1)", () => {
  it("discovers the log exactly once at mount — filteredLog === log must reuse the full discovery, not recompute it", () => {
    vi.mocked(discoverGraph).mockClear();
    renderHook(() => useProcessExplorer(orderToCash));
    // Decision §1.4 step 3 / §4: "with no intents active `filteredLog === log`, so the
    // pipeline reuses `fullRaw` for both roles and runs exactly one discovery — identical
    // to today." Before the G1 fix this read 2 (see RM-052-result-round3.md).
    expect(discoverGraph).toHaveBeenCalledTimes(1);
  });

  it("discovers the filtered log exactly once more after applyIntent, without re-discovering the unchanged full log", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    vi.mocked(discoverGraph).mockClear();
    act(() => result.current.applyIntent({ kind: "with", activity: "Reject Order" }));
    // `log` did not change, so the full derivation's memo must not re-fire; only the new
    // `filteredLog` reference is genuinely discovered.
    expect(discoverGraph).toHaveBeenCalledTimes(1);
  });
});

describe("useProcessExplorer — abstraction and metric setters merge, not replace", () => {
  it("setAbstraction patches only the given keys", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    act(() => result.current.setAbstraction({ activities: 0.5 }));
    expect(result.current.abstraction).toEqual({
      activities: 0.5,
      paths: 1,
      invert: false,
      keepConnected: true,
    });
    act(() => result.current.setAbstraction({ invert: true }));
    expect(result.current.abstraction).toEqual({
      activities: 0.5,
      paths: 1,
      invert: true,
      keepConnected: true,
    });
  });

  it("setMetric patches only node or edge, not both", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    act(() => result.current.setMetric({ node: "median" }));
    expect(result.current.metric).toEqual({ node: "median", edge: "absolute" });
  });

  it("honours initial abstraction/metric options", () => {
    const { result } = renderHook(() =>
      useProcessExplorer(orderToCash, {
        abstraction: { activities: 0.25 },
        metric: { edge: "median" },
      }),
    );
    expect(result.current.abstraction.activities).toBe(0.25);
    expect(result.current.metric).toEqual({ node: "absolute", edge: "median" });
  });
});

describe("useProcessExplorer — selection", () => {
  it("onSelect round-trips into `selection`, including clearing it", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    act(() => result.current.onSelect({ kind: "activity", id: "Check Credit" }));
    expect(result.current.selection).toEqual({ kind: "activity", id: "Check Credit" });
    act(() => result.current.onSelect(null));
    expect(result.current.selection).toBeNull();
  });
});

describe("useProcessExplorer — filter intents (the RM-052 acceptance criterion)", () => {
  const ALL_ACTIVITIES = [
    "Amend Order",
    "Approve Order",
    "Check Credit",
    "Create Order",
    "Receive Payment",
    "Reject Order",
    "Send Invoice",
    "Ship Order",
  ];
  const SURVIVING = ["Check Credit", "Create Order", "Reject Order"];
  const EXCLUDED = ALL_ACTIVITIES.filter((id) => !SURVIVING.includes(id));

  it("applying an intent RE-INKS the excluded activities rather than removing them (Invariant F, #227)", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    const before = result.current.graph;
    expect(before.activities).toHaveLength(8);

    // "Reject Order" only occurs in case-3 of the fixture — a real, non-trivial filter.
    act(() => result.current.applyIntent({ kind: "with", activity: "Reject Order" }));
    expect(result.current.intents).toEqual([{ kind: "with", activity: "Reject Order" }]);
    // Sanity: the intent actually changed the graph — this test would be vacuous otherwise.
    expect(result.current.graph).not.toEqual(before);

    // Invariant F: every one of the eight activities is STILL in the rendered graph — the
    // filter never shrinks the node set, it only re-inks the five it dropped.
    expect(result.current.graph.activities.map((a) => a.id).sort()).toEqual(
      [...ALL_ACTIVITIES].sort(),
    );
    expect(Object.keys(result.current.selectionStates.activities ?? {}).sort()).toEqual(
      [...EXCLUDED].sort(),
    );
    for (const id of EXCLUDED) {
      expect(result.current.selectionStates.activities?.[id]).toBe("excluded");
      const ghost = result.current.graph.activities.find((a) => a.id === id)!;
      expect(ghost.instances).toBe(0);
      expect(ghost.cases).toBe(0);
    }
    for (const id of SURVIVING) {
      expect(result.current.selectionStates.activities?.[id]).toBeUndefined();
      const survivor = result.current.graph.activities.find((a) => a.id === id)!;
      expect(survivor.instances).toBeGreaterThan(0);
    }

    // `excludedCounts` — disjoint from `hiddenCounts` (abstraction is untouched, at identity).
    expect(result.current.excludedCounts).toEqual({
      activities: EXCLUDED.length,
      paths: expect.any(Number),
    });
    expect(result.current.excludedCounts.paths).toBeGreaterThan(0);
    expect(result.current.hiddenCounts).toEqual({ activities: 0, paths: 0 });
  });

  it("clearIntent(0) restores the unfiltered graph exactly (deep equality) and clears selectionStates", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    const before = result.current.graph;

    act(() => result.current.applyIntent({ kind: "with", activity: "Reject Order" }));
    expect(result.current.graph).not.toEqual(before);

    act(() => result.current.clearIntent(0));
    expect(result.current.intents).toEqual([]);
    expect(result.current.graph).toEqual(before);
    expect(result.current.selectionStates.activities).toEqual({});
    expect(result.current.selectionStates.transitions).toEqual({});
    expect(result.current.excludedCounts).toEqual({ activities: 0, paths: 0 });
  });

  it("clearIntent removes by index, leaving the others in place", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    act(() => {
      result.current.applyIntent({ kind: "with", activity: "Create Order" });
      result.current.applyIntent({ kind: "without", activity: "Amend Order" });
    });
    expect(result.current.intents).toHaveLength(2);
    act(() => result.current.clearIntent(0));
    expect(result.current.intents).toEqual([{ kind: "without", activity: "Amend Order" }]);
  });
});

describe("useProcessExplorer — selectionStates.variants (RM-052 round 3, #227, G2)", () => {
  it('marks each id of an active "variant" intent "selected"', () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    act(() => result.current.applyIntent({ kind: "variant", ids: ["variant-a", "variant-b"] }));
    // Decision §1.4 step 5. Before this fix `selectionStates.variants` was `undefined` —
    // the namespace was declared on `ProcessSelectionStates` and never populated.
    expect(result.current.selectionStates.variants).toEqual({
      "variant-a": "selected",
      "variant-b": "selected",
    });
  });

  it("leaves variants EMPTY (not absent) when the active intent is unrelated to variants", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    act(() => result.current.applyIntent({ kind: "with", activity: "Reject Order" }));
    expect(result.current.selectionStates.variants).toEqual({});
  });
});

describe("useProcessExplorer — hiddenCounts sourced from abstractGraph's own `hidden` field", () => {
  it("reflects the current abstraction, not the intents", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    act(() => result.current.setAbstraction({ activities: 0.5 }));
    const total = discoverGraph(orderToCash).activities.length;
    const naiveKept = Math.round(total * 0.5) || 1;
    expect(result.current.hiddenCounts).toEqual(result.current.graph.hidden);
    // `abstractGraph`'s connectivity repair (`reconnect`) can ADD activities back beyond
    // the naive rank-truncated count to keep every kept node reachable — so hidden can
    // only be <= the naive count, never more, on a real (non-empty-edge) graph.
    expect(result.current.hiddenCounts.activities).toBeGreaterThanOrEqual(0);
    expect(result.current.hiddenCounts.activities).toBeLessThanOrEqual(total - naiveKept);
    // Sanity: some abstraction is actually happening at 50%, not a total no-op.
    expect(result.current.hiddenCounts.activities).toBeGreaterThan(0);
  });

  it("stays UNMOVED by a filter intent — abstraction and filtering are disjoint (#227)", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    act(() => result.current.setAbstraction({ activities: 0.5 }));
    const hiddenBeforeFilter = result.current.hiddenCounts;

    act(() => result.current.applyIntent({ kind: "with", activity: "Reject Order" }));
    // The filter changed what is EXCLUDED (re-inked), never what abstraction HID.
    expect(result.current.hiddenCounts).toEqual(hiddenBeforeFilter);
    expect(result.current.excludedCounts.activities).toBeGreaterThan(0);
  });
});

describe("useProcessExplorer — layer (RM-052 round 2, #227, F6)", () => {
  it("defaults to frequency, honours an initial option, and setLayer is a plain setter", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    expect(result.current.layer).toBe("frequency");
    act(() => result.current.setLayer("performance"));
    expect(result.current.layer).toBe("performance");
    // A plain setter — it does not touch `metric` on its own; `MetricLayerSwitch` owns the
    // frequency/performance coercion.
    expect(result.current.metric).toEqual({ node: "absolute", edge: "absolute" });

    const initial = renderHook(() => useProcessExplorer(orderToCash, { layer: "rework" }));
    expect(initial.result.current.layer).toBe("rework");
  });
});

describe("useProcessExplorer — kpis and rework (derived from the FILTERED log, not the abstracted graph)", () => {
  it("matches the /core primitives directly", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    const expectedGraph = discoverGraph(orderToCash);
    const expectedVariants = extractVariants(orderToCash);
    const expectedRework = detectRework(orderToCash);
    const expectedMedian = durationStats(
      asNormalizedLog(orderToCash).cases.map((kase) => kase.duration),
    ).median;

    expect(result.current.kpis).toEqual({
      cases: expectedGraph.totals.cases,
      events: expectedGraph.totals.events,
      variants: expectedVariants.length,
      medianThroughput: expectedMedian,
      reworkRate: expectedRework.caseReworkRate,
    });
    expect(result.current.rework).toEqual(expectedRework);
    // Fixture-specific: case-4 repeats "Check Credit" non-adjacently (a loop, not a
    // self-loop) — exactly one of the five cases carries rework.
    expect(result.current.kpis.reworkRate).toBe(0.2);
  });

  it("kpis stay based on the FILTERED log even while abstraction hides most of the graph", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    act(() => result.current.setAbstraction({ activities: 0.1 }));
    expect(result.current.graph.activities.length).toBeLessThan(
      discoverGraph(orderToCash).activities.length,
    );
    // Totals are untouched — RM-050's "sliders never change statistics" property.
    expect(result.current.kpis.cases).toBe(5);
    expect(result.current.kpis.events).toBe(discoverGraph(orderToCash).totals.events);
  });
});

describe("useProcessExplorer — the async gap (`loading`)", () => {
  it("stays false for a log at or under the worker threshold", () => {
    const { result } = renderHook(() => useProcessExplorer(orderToCash));
    expect(result.current.loading).toBe(false);
  });

  it("is true while a worker request is in flight, then false once it resolves", async () => {
    const worker = new FakeWorker();
    const { result } = renderHook(() =>
      useProcessExplorer(orderToCash, {
        workerThreshold: 0,
        worker: { createWorker: () => worker },
      }),
    );
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.graph.totals).toEqual(discoverGraph(orderToCash).totals);
    expect(result.current.variants).toEqual(extractVariants(orderToCash));
  });

  it("a later request supersedes an earlier one still in flight", async () => {
    const worker = new FakeWorker();
    const other: EventLog = { events: orderToCash.events.slice(0, 6) }; // case-1 and case-2 only
    const { result, rerender } = renderHook(
      ({ log }: { log: EventLog }) =>
        useProcessExplorer(log, { workerThreshold: 0, worker: { createWorker: () => worker } }),
      { initialProps: { log: orderToCash } },
    );
    expect(result.current.loading).toBe(true);
    // Change the log before the first request's microtask has a chance to settle.
    rerender({ log: other });
    await waitFor(() => expect(result.current.loading).toBe(false));
    // The settled graph reflects the LATEST log, never the superseded first request.
    expect(result.current.graph.totals).toEqual(discoverGraph(other).totals);
  });
});
