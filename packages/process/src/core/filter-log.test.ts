import { describe, expect, it } from "vitest";

import { discoverGraph } from "./discover-graph";
import { normalizeLog } from "./event-log";
import { extractVariants, variantId } from "./extract-variants";
import { caseMatchesFilters, filterLog, filterNormalizedLog, type FilterSpec } from "./filter-log";
import fixture from "./fixtures/order-to-cash-small.json";
import type { EventLog } from "./types";

const orderToCash = fixture as EventLog;

/**
 * The five traces in `order-to-cash-small.json` (see `discover-graph.test.ts` for the
 * full listing). What matters here:
 *
 *   case-1, case-2  the happy path, ending in Receive Payment
 *   case-3          Create Order · Check Credit · Reject Order
 *   case-4          the happy path with an Amend Order detour and a second Check Credit
 *   case-5          the happy path with Send Invoice and Ship Order swapped
 */
const survivors = (log: EventLog, specs: FilterSpec[]): string[] => [
  ...new Set(filterLog(log, specs).events.map((row) => row.caseId)),
];

describe("filterLog case predicates", () => {
  it("keeps or drops on activity presence", () => {
    expect(survivors(orderToCash, [{ kind: "with", activity: "Reject Order" }])).toEqual([
      "case-3",
    ]);
    expect(survivors(orderToCash, [{ kind: "without", activity: "Reject Order" }])).toEqual([
      "case-1",
      "case-2",
      "case-4",
      "case-5",
    ]);
  });

  it("matches on the first and last activity of a trace", () => {
    expect(survivors(orderToCash, [{ kind: "startsWith", activity: "Create Order" }])).toHaveLength(
      5,
    );
    expect(survivors(orderToCash, [{ kind: "endsWith", activity: "Reject Order" }])).toEqual([
      "case-3",
    ]);
  });

  it("separates a direct follower from an eventual one", () => {
    // Ship Order is directly followed by Send Invoice in cases 1, 2 and 4; in case-5 the
    // two are swapped, so Send Invoice still EVENTUALLY follows nothing of the sort —
    // there Ship Order comes second and Receive Payment follows it.
    expect(
      survivors(orderToCash, [
        { kind: "follower", a: "Ship Order", b: "Send Invoice", direct: true },
      ]),
    ).toEqual(["case-1", "case-2", "case-4"]);
    expect(
      survivors(orderToCash, [{ kind: "follower", a: "Create Order", b: "Receive Payment" }]),
    ).toEqual(["case-1", "case-2", "case-4", "case-5"]);
    // Eventually-follows is not symmetric, and does not fire on the same occurrence twice.
    expect(
      survivors(orderToCash, [{ kind: "follower", a: "Receive Payment", b: "Create Order" }]),
    ).toEqual([]);
  });

  it("filters on the case's throughput time, inclusive at both bounds", () => {
    const durations = normalizeLog(orderToCash).cases.map((kase) => kase.duration);
    const shortest = Math.min(...durations);
    expect(survivors(orderToCash, [{ kind: "duration", max: shortest }])).toEqual(["case-3"]);
    expect(survivors(orderToCash, [{ kind: "duration", min: shortest }])).toHaveLength(5);
    expect(survivors(orderToCash, [{ kind: "duration" }])).toHaveLength(5);
  });

  it("selects by variant id and by case id", () => {
    const variants = extractVariants(orderToCash);
    const busiest = variants[0] as { id: string; caseIds: string[] };
    expect(survivors(orderToCash, [{ kind: "variant", ids: [busiest.id] }])).toEqual(
      busiest.caseIds,
    );
    expect(variantId(["Create Order", "Check Credit", "Reject Order"])).toBe(
      (variants.find((variant) => variant.sequence.includes("Reject Order")) as { id: string }).id,
    );
    expect(survivors(orderToCash, [{ kind: "cases", ids: ["case-2", "case-5"] }])).toEqual([
      "case-2",
      "case-5",
    ]);
  });

  it("ANDs its specs, and keeps everything when given none", () => {
    expect(
      survivors(orderToCash, [
        { kind: "with", activity: "Check Credit" },
        { kind: "without", activity: "Amend Order" },
        { kind: "endsWith", activity: "Receive Payment" },
      ]),
    ).toEqual(["case-1", "case-2", "case-5"]);
    expect(filterLog(orderToCash, [])).toBe(orderToCash);
  });
});

describe("filterLog attribute predicates", () => {
  const withAttributes: EventLog = {
    events: [
      { caseId: "c1", activity: "A", timestamp: 0, resource: "Robot" },
      { caseId: "c1", activity: "B", timestamp: 1000, resource: "Ada" },
      { caseId: "c2", activity: "A", timestamp: 0, resource: "Ada" },
      { caseId: "c3", activity: "A", timestamp: 0, attributes: { amount: 250 } },
    ],
    caseAttributes: {
      c1: { region: "North", priority: 3 },
      c2: { region: "South", priority: 1 },
    },
  };

  const keep = (spec: FilterSpec): string[] => survivors(withAttributes, [spec]);

  it("reads a case attribute", () => {
    expect(keep({ kind: "attribute", key: "region", op: "eq", value: "North" })).toEqual(["c1"]);
    expect(keep({ kind: "attribute", key: "priority", op: "gt", value: 2 })).toEqual(["c1"]);
    expect(keep({ kind: "attribute", key: "priority", op: "lt", value: 2 })).toEqual(["c2"]);
    expect(keep({ kind: "attribute", key: "region", op: "in", value: ["North", "South"] })).toEqual(
      ["c1", "c2"],
    );
  });

  it("falls back to the events — including `resource` — when the case has no such attribute", () => {
    expect(keep({ kind: "attribute", key: "resource", op: "eq", value: "Robot" })).toEqual(["c1"]);
    expect(keep({ kind: "attribute", key: "resource", op: "eq", value: "Ada" })).toEqual([
      "c1",
      "c2",
    ]);
    expect(keep({ kind: "attribute", key: "amount", op: "gt", value: 100 })).toEqual(["c3"]);
  });

  it("treats `ne` as the negation of `eq`, not as `some value differs`", () => {
    // c1's events carry BOTH Robot and Ada, so an `eq`/`ne` pair on the same value must
    // never both match it — otherwise a filter and its complement would overlap.
    const matched = keep({ kind: "attribute", key: "resource", op: "eq", value: "Ada" });
    const unmatched = keep({ kind: "attribute", key: "resource", op: "ne", value: "Ada" });
    expect(matched).toEqual(["c1", "c2"]);
    expect(unmatched).toEqual(["c3"]);
    expect(matched.filter((id) => unmatched.includes(id))).toEqual([]);
  });

  it("does not compare across types, and needs an array for `in`", () => {
    expect(keep({ kind: "attribute", key: "priority", op: "gt", value: "2" })).toEqual([]);
    expect(keep({ kind: "attribute", key: "region", op: "in", value: "North" })).toEqual([]);
  });

  it("narrows caseAttributes to the survivors", () => {
    const filtered = filterLog(withAttributes, [
      { kind: "attribute", key: "region", op: "eq", value: "North" },
    ]);
    expect(filtered.caseAttributes).toEqual({ c1: { region: "North", priority: 3 } });
  });
});

describe("filterLog composition", () => {
  it("keeps every ROW of a surviving case, in input order", () => {
    const filtered = filterLog(orderToCash, [{ kind: "with", activity: "Amend Order" }]);
    expect(filtered.events).toEqual(orderToCash.events.filter((row) => row.caseId === "case-4"));
  });

  it("feeds discoverGraph and extractVariants unchanged", () => {
    const filtered = filterLog(orderToCash, [{ kind: "without", activity: "Reject Order" }]);
    const graph = discoverGraph(filtered);
    expect(graph.totals.cases).toBe(4);
    expect(graph.activities.map((activity) => activity.id)).not.toContain("Reject Order");
    expect(extractVariants(filtered).map((variant) => variant.count)).toEqual([2, 1, 1]);
  });

  it("agrees with filterNormalizedLog, which normalizes at most once", () => {
    const specs: FilterSpec[] = [{ kind: "endsWith", activity: "Receive Payment" }];
    const normalized = normalizeLog(orderToCash);
    const viaNormalized = filterNormalizedLog(normalized, specs);
    expect(viaNormalized.cases.map((kase) => kase.caseId)).toEqual(survivors(orderToCash, specs));
    expect(viaNormalized.totals).toEqual({ cases: 4, events: 26 });
    // The surviving cases are the ORIGINAL objects — no re-derivation happened.
    for (const kase of viaNormalized.cases) expect(normalized.cases).toContain(kase);
  });

  it("returns the input untouched when there is nothing to filter on", () => {
    const normalized = normalizeLog(orderToCash);
    expect(filterNormalizedLog(normalized, [])).toBe(normalized);
  });

  it("exposes the predicate on its own, for highlighting rather than removing", () => {
    const normalized = normalizeLog(orderToCash);
    const rejected = normalized.cases.filter((kase) =>
      caseMatchesFilters(kase, [{ kind: "with", activity: "Reject Order" }]),
    );
    expect(rejected.map((kase) => kase.caseId)).toEqual(["case-3"]);
  });
});
