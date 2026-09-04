/**
 * calendar-layout.ts — the pure 52×7 calendar layout behind
 * `HeatmapChart variant="calendar"` (RM-021).
 *
 * Provenance: `L17 Calendar Heat` in the lieflat gallery — a year of days as
 * 7 weekday rows × ~53 week columns, with a month tick above the week that
 * contains each month's first Monday.
 *
 * ## Why this module is pure, and dependency-free
 *
 * Calendar arithmetic is where a chart quietly goes wrong: a day lands in the
 * wrong column, a month tick drifts by a week, a DST Sunday shifts every later
 * cell. None of that is visible in a screenshot — 365 small squares look
 * plausible in any arrangement — so the layout is separated from the rendering
 * and asserted directly (`calendar-layout.test.ts`). No React, no `@visx`, no
 * `d3`.
 *
 * ## Everything is UTC, on purpose
 *
 * A calendar cell is a CALENDAR DAY, not an instant. Reading `2026-03-29` in a
 * local zone that changes offset that morning can yield the previous day, which
 * would put the cell one column to the left for readers in one half of the
 * world and not the other. Every date here is normalised to UTC midnight and
 * every field is read with `getUTC*`, so the same input produces the same grid
 * in every zone.
 *
 * ## Week rows are ISO (Monday-first)
 *
 * Row 0 is Monday, row 6 is Sunday — the ISO-8601 convention L17 draws and the
 * one the month-tick rule ("the first Monday of each month") is stated in. A
 * Sunday-first variant would need a different tick rule, so the two are not
 * independently configurable here.
 */

/** Milliseconds in one day. */
export const MS_PER_DAY = 86_400_000;

/** Milliseconds in one week. */
export const MS_PER_WEEK = MS_PER_DAY * 7;

/** Rows in a calendar heatmap — one per ISO weekday. Not configurable. */
export const CALENDAR_ROWS = 7;

/** Matches a leading `YYYY-MM-DD`, the shape a calendar heatmap's `x` values take. */
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Strips a `Date` down to UTC midnight of its own UTC calendar day. */
function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Parse a calendar heatmap's `x` value into a UTC-midnight `Date`, or `null`
 * when it is not a date at all.
 *
 * A leading `YYYY-MM-DD` is read FIELD BY FIELD rather than handed to the
 * `Date` constructor, so the result never depends on how a runtime chooses to
 * interpret a bare date string. Anything else (a full ISO timestamp, an epoch
 * number, a `Date`) falls back to `new Date(value)` and is then normalised to
 * its UTC day.
 *
 * Returning `null` instead of an Invalid Date is deliberate: the caller has to
 * decide what an unparsable row means (the chart drops it and says how many),
 * and a silently-`NaN` date is the "RangeError: Invalid time value" class of
 * bug this package already guards against in its test double.
 */
export function parseIsoDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : utcMidnight(value);
  }
  if (typeof value === "number") {
    const fromEpoch = new Date(value);
    return Number.isNaN(fromEpoch.getTime()) ? null : utcMidnight(fromEpoch);
  }
  if (typeof value !== "string") {
    return null;
  }
  const match = ISO_DATE_RE.exec(value.trim());
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : utcMidnight(parsed);
}

/** ISO weekday index of a UTC date: 0 = Monday … 6 = Sunday. */
export function isoWeekdayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

/** UTC midnight of the Monday that opens `date`'s ISO week. */
export function startOfIsoWeek(date: Date): Date {
  return new Date(utcMidnight(date).getTime() - isoWeekdayIndex(date) * MS_PER_DAY);
}

/** UTC midnight of the first Monday of `year`/`month` (0-based month). */
export function firstMondayOfMonth(year: number, month: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  return new Date(first.getTime() + ((7 - isoWeekdayIndex(first)) % 7) * MS_PER_DAY);
}

/** One placed day. `column` is the week, `row` the ISO weekday. */
export interface CalendarCellPosition {
  /** The `x` value exactly as it appeared in the caller's row. */
  key: string;
  /** UTC midnight of the day. */
  date: Date;
  /** Week index, 0-based from the Monday that opens the domain's first week. */
  column: number;
  /** ISO weekday index: 0 = Monday … 6 = Sunday. */
  row: number;
}

/** A month label above the week column that contains that month's first Monday. */
export interface CalendarMonthTick {
  /** Full year, e.g. 2026. */
  year: number;
  /** 0-based month, so it can be handed straight to `Date.UTC`. */
  month: number;
  /** Week column the label sits above. */
  column: number;
}

export interface CalendarLayout {
  /** One entry per parsable key, in the order the keys were given. */
  cells: CalendarCellPosition[];
  /** Number of week columns spanned by the domain. */
  columns: number;
  /** Always {@link CALENDAR_ROWS} — a week has seven days. */
  rows: number;
  /** Month labels, ascending by column. */
  monthTicks: CalendarMonthTick[];
  /** UTC midnight of the earliest day, or `null` when nothing parsed. */
  start: Date | null;
  /** UTC midnight of the latest day, or `null` when nothing parsed. */
  end: Date | null;
  /** Keys that did not parse as a date. The caller decides what to say about them. */
  invalidKeys: string[];
}

/**
 * Place a set of ISO date keys onto the 7-row week grid.
 *
 * The domain is the keys themselves — the first column is the ISO week of the
 * EARLIEST key, so a partial year (a quarter, six weeks) draws as a partial
 * grid rather than being padded out to 52 columns of blanks.
 *
 * Month ticks land on the week column containing that month's first Monday, and
 * only when that Monday falls inside the domain's own column range: a label
 * hanging off the end of the grid points at nothing.
 */
export function buildCalendarLayout(keys: readonly string[]): CalendarLayout {
  const cells: CalendarCellPosition[] = [];
  const invalidKeys: string[] = [];
  let start: Date | null = null;
  let end: Date | null = null;

  for (const key of keys) {
    const date = parseIsoDate(key);
    if (!date) {
      invalidKeys.push(key);
      continue;
    }
    cells.push({ key, date, column: 0, row: isoWeekdayIndex(date) });
    if (!start || date.getTime() < start.getTime()) start = date;
    if (!end || date.getTime() > end.getTime()) end = date;
  }

  if (!start || !end) {
    return { cells: [], columns: 0, rows: CALENDAR_ROWS, monthTicks: [], start, end, invalidKeys };
  }

  const weekZero = startOfIsoWeek(start).getTime();
  const columnOf = (date: Date): number =>
    Math.round((startOfIsoWeek(date).getTime() - weekZero) / MS_PER_WEEK);

  for (const cell of cells) {
    cell.column = columnOf(cell.date);
  }
  const columns = columnOf(end) + 1;

  const monthTicks: CalendarMonthTick[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const lastMonth = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1);
  while (cursor.getTime() <= lastMonth) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const column = columnOf(firstMondayOfMonth(year, month));
    if (column >= 0 && column < columns) {
      monthTicks.push({ year, month, column });
    }
    cursor.setUTCMonth(month + 1);
  }

  return { cells, columns, rows: CALENDAR_ROWS, monthTicks, start, end, invalidKeys };
}
