import { describe, expect, it } from "vitest";

import { asNormalizedLog, isNormalizedLog, normalizeLog, toEpochMs } from "./event-log";
import type { EventLog } from "./types";

const T = (iso: string): number => Date.parse(iso);

describe("toEpochMs", () => {
  it("resolves all three accepted timestamp encodings", () => {
    expect(toEpochMs("2026-01-05T09:00:00.000Z")).toBe(T("2026-01-05T09:00:00.000Z"));
    expect(toEpochMs(1_767_600_000_000)).toBe(1_767_600_000_000);
    expect(toEpochMs(new Date("2026-01-05T09:00:00.000Z"))).toBe(T("2026-01-05T09:00:00.000Z"));
  });

  it("reads a bare numeric string as epoch milliseconds", () => {
    expect(toEpochMs("1767600000000")).toBe(1_767_600_000_000);
  });

  it("answers NaN for an unparseable or absent value instead of throwing", () => {
    expect(toEpochMs("not a date")).toBeNaN();
    expect(toEpochMs(undefined)).toBeNaN();
    expect(toEpochMs(null)).toBeNaN();
  });
});

describe("normalizeLog", () => {
  it("groups by case and orders each case in time without sorting the whole log", () => {
    const log: EventLog = {
      events: [
        { caseId: "b", activity: "B2", timestamp: "2026-01-05T11:00:00Z" },
        { caseId: "a", activity: "A2", timestamp: "2026-01-05T10:00:00Z" },
        { caseId: "b", activity: "B1", timestamp: "2026-01-05T09:00:00Z" },
        { caseId: "a", activity: "A1", timestamp: "2026-01-05T09:30:00Z" },
      ],
    };
    const normalized = normalizeLog(log);
    // Cases keep FIRST-APPEARANCE order; events inside each case are sorted.
    expect(normalized.cases.map((c) => c.caseId)).toEqual(["b", "a"]);
    expect(normalized.cases[0]?.events.map((e) => e.activity)).toEqual(["B1", "B2"]);
    expect(normalized.cases[1]?.events.map((e) => e.activity)).toEqual(["A1", "A2"]);
    expect(normalized.totals).toEqual({ cases: 2, events: 4 });
  });

  it("pairs start/complete rows that are NOT adjacent in the input", () => {
    // Interleaved lifecycle rows, and the rows themselves arrive out of time order.
    const log: EventLog = {
      events: [
        {
          caseId: "c1",
          activity: "Pack",
          lifecycle: "complete",
          timestamp: "2026-01-05T12:00:00Z",
        },
        { caseId: "c1", activity: "Pick", lifecycle: "start", timestamp: "2026-01-05T09:00:00Z" },
        { caseId: "c1", activity: "Pack", lifecycle: "start", timestamp: "2026-01-05T10:00:00Z" },
        {
          caseId: "c1",
          activity: "Pick",
          lifecycle: "complete",
          timestamp: "2026-01-05T11:00:00Z",
        },
      ],
    };
    const [kase] = normalizeLog(log).cases;
    expect(kase?.events).toEqual([
      {
        activity: "Pick",
        start: T("2026-01-05T09:00:00Z"),
        end: T("2026-01-05T11:00:00Z"),
        duration: 7_200_000,
        isOpen: false,
      },
      {
        activity: "Pack",
        start: T("2026-01-05T10:00:00Z"),
        end: T("2026-01-05T12:00:00Z"),
        duration: 7_200_000,
        isOpen: false,
      },
    ]);
    expect(kase?.duration).toBe(10_800_000);
  });

  it("pairs repeated executions of one activity oldest-start to earliest-complete", () => {
    const log: EventLog = {
      events: [
        { caseId: "c1", activity: "Pick", lifecycle: "start", timestamp: "2026-01-05T09:00:00Z" },
        { caseId: "c1", activity: "Pick", lifecycle: "start", timestamp: "2026-01-05T09:30:00Z" },
        {
          caseId: "c1",
          activity: "Pick",
          lifecycle: "complete",
          timestamp: "2026-01-05T10:00:00Z",
        },
        {
          caseId: "c1",
          activity: "Pick",
          lifecycle: "complete",
          timestamp: "2026-01-05T11:00:00Z",
        },
      ],
    };
    const events = normalizeLog(log).cases[0]?.events ?? [];
    expect(events.map((e) => [e.start, e.end])).toEqual([
      [T("2026-01-05T09:00:00Z"), T("2026-01-05T10:00:00Z")],
      [T("2026-01-05T09:30:00Z"), T("2026-01-05T11:00:00Z")],
    ]);
  });

  it("leaves an unmatched start OPEN rather than inventing a completion", () => {
    const log: EventLog = {
      events: [
        { caseId: "c1", activity: "Pick", lifecycle: "start", timestamp: "2026-01-05T09:00:00Z" },
      ],
    };
    const event = normalizeLog(log).cases[0]?.events[0];
    expect(event?.isOpen).toBe(true);
    expect(event?.start).toBe(event?.end);
    expect(event?.duration).toBe(0);
  });

  it("uses an explicit startTimestamp when a complete row has no matching start", () => {
    const log: EventLog = {
      events: [
        {
          caseId: "c1",
          activity: "Ship",
          lifecycle: "complete",
          startTimestamp: "2026-01-05T09:00:00Z",
          timestamp: "2026-01-05T10:00:00Z",
        },
      ],
    };
    expect(normalizeLog(log).cases[0]?.events[0]).toMatchObject({
      start: T("2026-01-05T09:00:00Z"),
      duration: 3_600_000,
      isOpen: false,
    });
  });

  it("treats a row with no lifecycle as atomic", () => {
    const log: EventLog = {
      events: [{ caseId: "c1", activity: "Ship", timestamp: "2026-01-05T10:00:00Z" }],
    };
    const event = normalizeLog(log).cases[0]?.events[0];
    expect(event?.start).toBe(event?.end);
    expect(event?.duration).toBe(0);
    expect(event?.isOpen).toBe(false);
  });

  it("floors a clock-skewed pair at zero instead of reporting a negative duration", () => {
    const log: EventLog = {
      events: [
        {
          caseId: "c1",
          activity: "Ship",
          startTimestamp: "2026-01-05T11:00:00Z",
          timestamp: "2026-01-05T10:00:00Z",
        },
      ],
    };
    expect(normalizeLog(log).cases[0]?.events[0]?.duration).toBe(0);
  });

  it("carries resources, event attributes and case attributes through", () => {
    const log: EventLog = {
      events: [
        {
          caseId: "c1",
          activity: "Ship",
          timestamp: "2026-01-05T10:00:00Z",
          resource: "Warehouse Robot",
          attributes: { carrier: "DPD", cost: 12.5 },
        },
      ],
      caseAttributes: { c1: { region: "North" } },
    };
    const [kase] = normalizeLog(log).cases;
    expect(kase?.attributes).toEqual({ region: "North" });
    expect(kase?.events[0]).toMatchObject({
      resource: "Warehouse Robot",
      attributes: { carrier: "DPD", cost: 12.5 },
    });
  });

  it("drops rows with no case id or no activity", () => {
    const log: EventLog = {
      events: [
        { caseId: "", activity: "Ship", timestamp: 1 },
        { caseId: "c1", activity: "", timestamp: 2 },
        { caseId: "c1", activity: "Ship", timestamp: 3 },
      ],
    };
    expect(normalizeLog(log).totals).toEqual({ cases: 1, events: 1 });
  });

  it("keeps rows with an unparseable timestamp in their input order", () => {
    const log: EventLog = {
      events: [
        { caseId: "c1", activity: "First", timestamp: "nonsense" },
        { caseId: "c1", activity: "Second", timestamp: "also nonsense" },
      ],
    };
    expect(normalizeLog(log).cases[0]?.events.map((e) => e.activity)).toEqual(["First", "Second"]);
  });

  it("answers an empty log with an empty result", () => {
    expect(normalizeLog({ events: [] })).toEqual({ cases: [], totals: { cases: 0, events: 0 } });
  });
});

describe("asNormalizedLog", () => {
  it("is idempotent — a normalized log passes through untouched", () => {
    const once = normalizeLog({
      events: [{ caseId: "c1", activity: "Ship", timestamp: 10 }],
    });
    expect(isNormalizedLog(once)).toBe(true);
    expect(asNormalizedLog(once)).toBe(once);
  });

  it("recognizes a raw log", () => {
    expect(isNormalizedLog({ events: [] })).toBe(false);
  });
});
