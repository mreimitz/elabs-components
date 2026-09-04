/**
 * calendar-layout — the pure day-to-grid placement behind `variant="calendar"`.
 *
 * Every assertion here is UTC. A calendar heatmap that resolved days in the
 * viewer's own zone would move a deploy across a column boundary depending on
 * who opened the dashboard, so the module never touches local time — and these
 * tests are what keeps that true.
 */

import { describe, expect, it } from "vitest";
import {
  buildCalendarLayout,
  CALENDAR_ROWS,
  firstMondayOfMonth,
  isoWeekdayIndex,
  MS_PER_DAY,
  parseIsoDate,
  startOfIsoWeek,
} from "./calendar-layout";

const iso = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;

/** Every day in `[from, to]`, inclusive, as `YYYY-MM-DD`. */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += MS_PER_DAY) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

describe("parseIsoDate", () => {
  it("reads a leading YYYY-MM-DD field by field", () => {
    expect(iso(parseIsoDate("2026-03-09"))).toBe("2026-03-09");
    expect(iso(parseIsoDate("2026-03-09T22:45:00+05:00"))).toBe("2026-03-09");
  });

  it("normalises a Date and an epoch number to their UTC day", () => {
    expect(iso(parseIsoDate(new Date("2026-03-09T23:59:59Z")))).toBe("2026-03-09");
    expect(iso(parseIsoDate(Date.parse("2026-03-09T00:00:00Z")))).toBe("2026-03-09");
  });

  it("returns null rather than an Invalid Date", () => {
    expect(parseIsoDate("Tuesday")).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
    expect(parseIsoDate(new Date("nope"))).toBeNull();
  });
});

describe("ISO week helpers", () => {
  it("indexes Monday as 0 and Sunday as 6", () => {
    // 2026-03-09 is a Monday.
    expect(isoWeekdayIndex(new Date("2026-03-09T00:00:00Z"))).toBe(0);
    expect(isoWeekdayIndex(new Date("2026-03-15T00:00:00Z"))).toBe(6);
  });

  it("opens a week on its Monday, including for a Sunday", () => {
    expect(iso(startOfIsoWeek(new Date("2026-03-15T00:00:00Z")))).toBe("2026-03-09");
    expect(iso(startOfIsoWeek(new Date("2026-03-09T00:00:00Z")))).toBe("2026-03-09");
  });

  it("finds the first Monday of a month, including when the 1st IS a Monday", () => {
    expect(iso(firstMondayOfMonth(2026, 5))).toBe("2026-06-01"); // 1 June 2026 is a Monday
    expect(iso(firstMondayOfMonth(2026, 0))).toBe("2026-01-05");
  });
});

describe("buildCalendarLayout", () => {
  const year = daysBetween("2026-01-01", "2026-12-31");
  const layout = buildCalendarLayout(year);

  it("places every day of a full year", () => {
    expect(year).toHaveLength(365);
    expect(layout.cells).toHaveLength(365);
    expect(layout.rows).toBe(CALENDAR_ROWS);
  });

  it("spans the weeks the domain actually covers", () => {
    // 2026-01-01 is a Thursday, so week 0 opens on 2025-12-29 and the year runs
    // into a 53rd column.
    expect(layout.columns).toBe(53);
    expect(iso(layout.start)).toBe("2026-01-01");
    expect(iso(layout.end)).toBe("2026-12-31");
  });

  it("ticks twelve months, each above its own first Monday", () => {
    expect(layout.monthTicks).toHaveLength(12);
    for (const tick of layout.monthTicks) {
      const monday = firstMondayOfMonth(tick.year, tick.month);
      const placed = layout.cells.find((cell) => cell.date.getTime() === monday.getTime());
      expect(placed?.column).toBe(tick.column);
      expect(placed?.row).toBe(0);
    }
  });

  it("keeps the columns monotonic and the rows weekday-true", () => {
    for (const cell of layout.cells) {
      expect(cell.row).toBe(isoWeekdayIndex(cell.date));
      expect(cell.column).toBeGreaterThanOrEqual(0);
      expect(cell.column).toBeLessThan(layout.columns);
    }
  });

  it("draws a partial domain as a partial grid, not a padded year", () => {
    const sixWeeks = buildCalendarLayout(daysBetween("2026-03-09", "2026-04-19"));
    expect(sixWeeks.columns).toBe(6);
    expect(sixWeeks.cells[0]?.column).toBe(0);
  });

  it("collects unparsable keys instead of placing them", () => {
    const mixed = buildCalendarLayout(["2026-03-09", "not-a-date", "2026-03-10"]);
    expect(mixed.cells).toHaveLength(2);
    expect(mixed.invalidKeys).toEqual(["not-a-date"]);
  });

  it("is empty, not broken, when nothing parses", () => {
    const none = buildCalendarLayout(["", "later"]);
    expect(none.cells).toHaveLength(0);
    expect(none.columns).toBe(0);
    expect(none.monthTicks).toHaveLength(0);
  });
});
