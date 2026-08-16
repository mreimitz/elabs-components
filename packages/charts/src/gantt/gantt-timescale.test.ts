/**
 * Timescale tick maths (#360 — sub-day time units).
 *
 * Pure functions only — no jsdom render needed. The point of this file is the
 * NO-REGRESSION freeze: the four calendar units (day/week/month/quarter) must
 * keep producing byte-identical tick arrays after the `GanttTimeUnit` superset
 * lands, and the calendar branches must NOT be rewritten as millisecond
 * arithmetic (DST days, variable-length months).
 */

import { describe, expect, it } from "vitest";
import { addUnit, generateTicks, MAX_TICKS, startOf } from "./gantt-timescale";

/**
 * `startOf`/`addUnit` are LOCAL-calendar, so the fixture is built from local
 * date parts and asserted with `toDateString()` (also local) — TZ-stable.
 */
const domainStart = new Date(2024, 2, 1); // Fri 2024-03-01, local midnight
const domainEnd = new Date(2024, 2, 15); // Fri 2024-03-15, local midnight

const asDays = (ticks: Date[]) => ticks.map((t) => t.toDateString());

describe("generateTicks — calendar units are frozen (#360 AC2)", () => {
  it("day ticks are unchanged", () => {
    expect(asDays(generateTicks(domainStart, domainEnd, "day"))).toEqual([
      "Fri Mar 01 2024",
      "Sat Mar 02 2024",
      "Sun Mar 03 2024",
      "Mon Mar 04 2024",
      "Tue Mar 05 2024",
      "Wed Mar 06 2024",
      "Thu Mar 07 2024",
      "Fri Mar 08 2024",
      "Sat Mar 09 2024",
      "Sun Mar 10 2024",
      "Mon Mar 11 2024",
      "Tue Mar 12 2024",
      "Wed Mar 13 2024",
      "Thu Mar 14 2024",
      "Fri Mar 15 2024",
    ]);
  });

  it("week ticks are unchanged (Monday-aligned)", () => {
    expect(asDays(generateTicks(domainStart, domainEnd, "week"))).toEqual([
      "Mon Feb 26 2024",
      "Mon Mar 04 2024",
      "Mon Mar 11 2024",
    ]);
  });

  it("month ticks are unchanged", () => {
    expect(asDays(generateTicks(domainStart, domainEnd, "month"))).toEqual(["Fri Mar 01 2024"]);
  });

  it("quarter ticks are unchanged", () => {
    expect(asDays(generateTicks(domainStart, domainEnd, "quarter"))).toEqual(["Mon Jan 01 2024"]);
  });

  it("every calendar tick still lands on LOCAL midnight (not ms arithmetic)", () => {
    for (const unit of ["day", "week", "month", "quarter"] as const) {
      for (const tick of generateTicks(domainStart, domainEnd, unit)) {
        expect([
          tick.getHours(),
          tick.getMinutes(),
          tick.getSeconds(),
          tick.getMilliseconds(),
        ]).toEqual([0, 0, 0, 0]);
      }
    }
  });
});

describe("startOf / addUnit — sub-day units (#360)", () => {
  const t = new Date(2026, 0, 15, 13, 44, 27, 512);

  it("startOf truncates at each sub-day granularity", () => {
    expect(startOf(t, "millisecond").getTime()).toBe(t.getTime());
    expect(startOf(t, "second").getMilliseconds()).toBe(0);
    expect(startOf(t, "second").getSeconds()).toBe(27);
    expect([startOf(t, "minute").getSeconds(), startOf(t, "minute").getMilliseconds()]).toEqual([
      0, 0,
    ]);
    expect(startOf(t, "minute").getMinutes()).toBe(44);
    expect([
      startOf(t, "hour").getMinutes(),
      startOf(t, "hour").getSeconds(),
      startOf(t, "hour").getMilliseconds(),
    ]).toEqual([0, 0, 0]);
    expect(startOf(t, "hour").getHours()).toBe(13);
  });

  it("addUnit steps sub-day units by exact milliseconds", () => {
    expect(addUnit(t, "millisecond").getTime() - t.getTime()).toBe(1);
    expect(addUnit(t, "second", 3).getTime() - t.getTime()).toBe(3_000);
    expect(addUnit(t, "minute", 2).getTime() - t.getTime()).toBe(120_000);
    expect(addUnit(t, "hour").getTime() - t.getTime()).toBe(3_600_000);
  });
});

describe("addUnit — calendar branches must stay calendrical (#360)", () => {
  it("month is calendar arithmetic, NOT +30 days", () => {
    // setMonth(Jan 31 → Feb 31) overflows to Mar 2 in a leap year.
    // A `+ 30 * 86_400_000` rewrite would land on Mar 1 instead.
    expect(addUnit(new Date(2024, 0, 31), "month").toDateString()).toBe("Sat Mar 02 2024");
    expect(addUnit(new Date(2026, 0, 31), "month").toDateString()).toBe("Tue Mar 03 2026");
  });

  it("quarter is calendar arithmetic, NOT +90 days", () => {
    expect(addUnit(new Date(2024, 0, 31), "quarter").toDateString()).toBe("Wed May 01 2024");
  });

  it("day stepping preserves local midnight across a DST transition", () => {
    // In a DST zone the last Sunday of March is 23h long; `+ 86_400_000` would
    // shift the tick to 01:00 and every later tick with it.
    const ticks = generateTicks(new Date(2026, 2, 27), new Date(2026, 3, 1), "day");
    expect(asDays(ticks)).toEqual([
      "Fri Mar 27 2026",
      "Sat Mar 28 2026",
      "Sun Mar 29 2026",
      "Mon Mar 30 2026",
      "Tue Mar 31 2026",
      "Wed Apr 01 2026",
    ]);
    for (const tick of ticks) expect(tick.getHours()).toBe(0);
  });
});

describe("generateTicks — stride guard (#360)", () => {
  it("caps a one-year millisecond domain at MAX_TICKS and returns fast", () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2027, 0, 1);
    const t0 = Date.now();
    const ticks = generateTicks(start, end, "millisecond");
    const elapsed = Date.now() - t0;
    expect(ticks.length).toBeLessThanOrEqual(MAX_TICKS);
    expect(ticks.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1_000);
  });

  it("leaves realistic calendar domains at stride 1 (no thinning)", () => {
    // 10 years of daily ticks ≈ 3 653 — well under the cap, so unchanged.
    const ticks = generateTicks(new Date(2020, 0, 1), new Date(2030, 0, 1), "day");
    expect(ticks.length).toBeGreaterThan(3_000);
    expect(ticks.length).toBeLessThan(MAX_TICKS);
    expect(ticks[1]!.getTime() - ticks[0]!.getTime()).toBe(86_400_000);
  });
});
