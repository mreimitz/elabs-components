import { describe, expect, it } from "vitest";

import { casesFromLog } from "./cases-from-log";
import { extractVariants } from "./extract-variants";
import fixture from "./fixtures/order-to-cash-small.json";
import type { EventLog } from "./types";

const orderToCash = fixture as EventLog;

describe("casesFromLog", () => {
  it("answers an empty log with an empty array", () => {
    expect(casesFromLog({ events: [] })).toEqual([]);
  });

  it("summarizes each case's own extent, size and duration", () => {
    const rows = casesFromLog(orderToCash);
    expect(rows.map((r) => r.caseId)).toEqual(["case-1", "case-2", "case-3", "case-4", "case-5"]);

    const case1 = rows.find((r) => r.caseId === "case-1");
    expect(case1).toMatchObject({
      start: "2026-01-05T09:00:00.000Z",
      end: "2026-01-05T14:00:00.000Z",
      durationMs: 18_000_000,
      eventCount: 6,
    });
  });

  it("assigns the SAME variantId extractVariants assigns the same case", () => {
    const rows = casesFromLog(orderToCash);
    const variants = extractVariants(orderToCash);

    for (const row of rows) {
      const variant = variants.find((v) => v.caseIds.includes(row.caseId));
      expect(row.variantId).toBe(variant?.id);
    }

    // case-1 and case-2 share the five-step happy path — same variant id.
    const case1 = rows.find((r) => r.caseId === "case-1");
    const case2 = rows.find((r) => r.caseId === "case-2");
    expect(case1?.variantId).toBe(case2?.variantId);
    expect(case1?.variantId).toBeTruthy();

    // case-3 (rejected early) follows a different path.
    const case3 = rows.find((r) => r.caseId === "case-3");
    expect(case3?.variantId).not.toBe(case1?.variantId);
  });

  it("never invents a conformance value", () => {
    const rows = casesFromLog(orderToCash);
    expect(rows.every((r) => r.conformance === undefined)).toBe(true);
  });

  it("carries per-case attributes through untouched", () => {
    const log: EventLog = {
      events: [{ caseId: "c1", activity: "A", timestamp: 0 }],
      caseAttributes: { c1: { region: "EU", priority: 2 } },
    };
    const rows = casesFromLog(log);
    expect(rows[0]?.attributes).toEqual({ region: "EU", priority: 2 });
  });

  it("answers an empty ISO start/end for a case with no resolvable extent", () => {
    // A "complete" row whose activity never opened and no explicit startTimestamp still
    // resolves — the only way to get NaN is an unparseable timestamp on every row.
    const log: EventLog = {
      events: [{ caseId: "c1", activity: "A", timestamp: "not-a-date" }],
    };
    const rows = casesFromLog(log);
    expect(rows[0]?.start).toBe("");
    expect(rows[0]?.end).toBe("");
  });
});
