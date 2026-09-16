import { describe, expect, it } from "vitest";
import { ACTIVITY_COLOR_SLOTS, ACTIVITY_OTHER_TOKEN } from "../core/activity-color-scale";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import type { EventLog } from "../core/types";
import { casesInBrush, computeDots, rankCategoryColors } from "./compute-dots";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** 2026-01-05 00:00 UTC — a Monday. */
const MONDAY = Date.UTC(2026, 0, 5);

/**
 * c-long starts first and runs longest; c-late starts last but ends before c-long;
 * c-short is the shortest and starts earliest in its day.
 */
const LOG: EventLog = {
  events: [
    { caseId: "c-long", activity: "A", timestamp: MONDAY + 9 * HOUR },
    { caseId: "c-long", activity: "B", timestamp: MONDAY + 2 * DAY + 10 * HOUR },
    { caseId: "c-short", activity: "A", timestamp: MONDAY + DAY + 6 * HOUR },
    { caseId: "c-short", activity: "C", timestamp: MONDAY + DAY + 7 * HOUR },
    { caseId: "c-late", activity: "A", timestamp: MONDAY + DAY + 20 * HOUR },
    { caseId: "c-late", activity: "B", timestamp: MONDAY + 2 * DAY + 2 * HOUR },
  ],
};

const ids = (rows: { caseId: string }[]) => rows.map((row) => row.caseId);

describe("computeDots — rows", () => {
  it("groups one row per case with one dot per event", () => {
    const model = computeDots(LOG);
    expect(model.rows).toHaveLength(3);
    expect(model.dots).toHaveLength(6);
    for (const row of model.rows) {
      const dots = model.dots.slice(row.dotStart, row.dotEnd);
      expect(dots).toHaveLength(row.eventCount);
      expect(dots.every((dot) => dot.caseId === row.caseId && dot.rowIndex === row.index)).toBe(
        true,
      );
    }
  });

  it("sorts by start (default), end, duration and start_day, ascending", () => {
    expect(ids(computeDots(LOG).rows)).toEqual(["c-long", "c-short", "c-late"]);
    expect(ids(computeDots(LOG, { sort: "end" }).rows)).toEqual(["c-short", "c-late", "c-long"]);
    expect(ids(computeDots(LOG, { sort: "duration" }).rows)).toEqual([
      "c-short",
      "c-late",
      "c-long",
    ]);
    expect(ids(computeDots(LOG, { sort: "start_day" }).rows)).toEqual([
      "c-short",
      "c-long",
      "c-late",
    ]);
  });

  it("carries first/last activity, extent and event count per row", () => {
    const row = computeDots(LOG).rows[0]!;
    expect(row).toMatchObject({
      caseId: "c-long",
      firstActivity: "A",
      lastActivity: "B",
      start: MONDAY + 9 * HOUR,
      end: MONDAY + 2 * DAY + 10 * HOUR,
      duration: 2 * DAY + HOUR,
      eventCount: 2,
    });
  });

  it("drops events with unparsable timestamps, and cases left with none", () => {
    const model = computeDots({
      events: [
        { caseId: "ok", activity: "A", timestamp: MONDAY },
        { caseId: "ok", activity: "B", timestamp: "not a date" },
        { caseId: "bad", activity: "A", timestamp: "nope" },
      ],
    });
    expect(ids(model.rows)).toEqual(["ok"]);
    expect(model.dots).toHaveLength(1);
  });

  it("yields an empty model with a non-zero domain for an empty log", () => {
    const model = computeDots({ events: [] });
    expect(model.rows).toEqual([]);
    expect(model.domain[1]).toBeGreaterThan(model.domain[0]);
  });
});

describe("computeDots — x modes", () => {
  it("absolute places the event start and spans the min/max", () => {
    const model = computeDots(LOG);
    expect(model.domain).toEqual([MONDAY + 9 * HOUR, MONDAY + 2 * DAY + 10 * HOUR]);
  });

  it("relative subtracts the case start from every event", () => {
    const model = computeDots(LOG, { x: "relative" });
    const long = model.rows.find((row) => row.caseId === "c-long")!;
    expect(model.dots.slice(long.dotStart, long.dotEnd).map((dot) => dot.x)).toEqual([
      0,
      2 * DAY + HOUR,
    ]);
    expect(model.domain[0]).toBe(0);
  });

  it("relative_day is UTC time of day on a fixed 24 h domain", () => {
    const model = computeDots(LOG, { x: "relative_day" });
    expect(model.domain).toEqual([0, DAY]);
    const late = model.rows.find((row) => row.caseId === "c-late")!;
    expect(model.dots.slice(late.dotStart, late.dotEnd).map((dot) => dot.x)).toEqual([
      20 * HOUR,
      2 * HOUR,
    ]);
  });

  it("relative_week is UTC time since Monday 00:00 on a fixed 7 d domain", () => {
    const model = computeDots(LOG, { x: "relative_week" });
    expect(model.domain).toEqual([0, 7 * DAY]);
    expect(model.dots[0]!.x).toBe(9 * HOUR);
    expect(model.dots[1]!.x).toBe(2 * DAY + 10 * HOUR);
  });
});

describe("casesInBrush", () => {
  it("returns covered case ids in row order, requiring a dot inside the x range", () => {
    const model = computeDots(LOG);
    // All rows, the whole domain.
    expect(casesInBrush(model, [2, 0], model.domain)).toEqual(ids(model.rows));
    // A stretch of time where only c-short and c-late have events.
    expect(
      casesInBrush(model, [0, 2], [MONDAY + DAY + 5 * HOUR, MONDAY + DAY + 21 * HOUR]),
    ).toEqual(["c-short", "c-late"]);
    // Rows 0–1 only.
    expect(casesInBrush(model, [0, 1], model.domain)).toEqual(["c-long", "c-short"]);
  });

  it("brushing 200 cases returns all 200 ids in rows order", () => {
    const model = computeDots(generateSyntheticLog({ cases: 260, seed: 5 }));
    const brushed = casesInBrush(model, [0, 199], model.domain);
    expect(brushed).toHaveLength(200);
    expect(brushed).toEqual(ids(model.rows.slice(0, 200)));
  });
});

describe("rankCategoryColors", () => {
  it("ranks by count and spends the same budget as activityColorScale", () => {
    const keys = Array.from({ length: 14 }, (_, i) =>
      Array.from({ length: 20 - i }, () => `k${String(i).padStart(2, "0")}`),
    ).flat();
    const ranked = rankCategoryColors(keys);
    expect(ranked).toHaveLength(14);
    expect(ranked[0]).toMatchObject({ key: "k00", count: 20, token: "--chart-1" });
    expect(ranked[ACTIVITY_COLOR_SLOTS - 1]!.token).toBe(`--chart-${ACTIVITY_COLOR_SLOTS}`);
    for (const entry of ranked.slice(ACTIVITY_COLOR_SLOTS)) {
      expect(entry).toMatchObject({ token: ACTIVITY_OTHER_TOKEN, pattern: "other" });
    }
  });
});

describe("computeDots — scale", () => {
  it("models 5 000 cases × ~20 events", () => {
    const events: EventLog["events"] = [];
    for (let c = 0; c < 5000; c += 1) {
      for (let e = 0; e < 20; e += 1) {
        events.push({
          caseId: `c${c}`,
          activity: `A${e % 9}`,
          timestamp: MONDAY + c * 60_000 + e * HOUR,
        });
      }
    }
    const model = computeDots({ events }, { sort: "duration" });
    expect(model.rows).toHaveLength(5000);
    expect(model.dots).toHaveLength(100_000);
  });
});
