/**
 * Pure model behind `DottedChart` (RM-059) — no React, no canvas, so the row order, the
 * time transform and the brush enumeration are fixture-testable on their own.
 *
 * A dotted chart puts one ROW per case and one DOT per event. `computeDots` groups a log by
 * case (through `/core`'s `normalizeLog`, so lifecycle pairs and the three timestamp
 * encodings are resolved exactly once), orders the rows by `sort`, and places every event
 * on the x axis according to `x`:
 *
 * - `absolute` — the event's own start time (epoch ms).
 * - `relative` — milliseconds since the case's first event.
 * - `relative_day` — time of day, `0 … 24 h` (UTC), so daily rhythms line up.
 * - `relative_week` — time of week, `0 … 7 d`, weeks starting Monday 00:00 (UTC).
 *
 * The two cyclic modes use UTC on purpose: a chart whose dots move when the reviewer's
 * machine changes time zone is not a deterministic fixture.
 */
import {
  ACTIVITY_COLOR_SLOTS,
  ACTIVITY_OTHER_TOKEN,
  type ActivityColor,
} from "../core/activity-color-scale";
import { asNormalizedLog, type AnyLog, type NormalizedEvent } from "../core/event-log";

/** How the x axis places an event. */
export type DottedChartX = "absolute" | "relative" | "relative_day" | "relative_week";

/** How case rows are ordered, top to bottom. Every order is ascending and stable. */
export type DottedChartSort = "start" | "end" | "duration" | "start_day";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
/** 1970-01-01 was a Thursday; shifting by 3 days makes weeks start on Monday. */
const MONDAY_OFFSET_MS = 3 * DAY_MS;

/** One event, placed on the chart. */
export interface DottedChartDot {
  kind: "dot";
  caseId: string;
  /** Index of this dot's row in {@link DottedChartModel.rows}. */
  rowIndex: number;
  /** The normalized event (activity, start, end, resource, attributes). */
  event: NormalizedEvent;
  /** The event's position on the x axis, in the unit `x` implies (always milliseconds). */
  x: number;
}

/** One case, placed on the chart. */
export interface DottedChartRow {
  kind: "row";
  caseId: string;
  /** Position in `rows` — top row is `0`. */
  index: number;
  start: number;
  end: number;
  duration: number;
  eventCount: number;
  firstActivity: string;
  lastActivity: string;
  /** This row's dots are `dots.slice(dotStart, dotEnd)`, in time order. */
  dotStart: number;
  dotEnd: number;
}

/** What {@link computeDots} returns. */
export interface DottedChartModel {
  x: DottedChartX;
  sort: DottedChartSort;
  rows: DottedChartRow[];
  /** Every dot, grouped by row in `rows` order, each row's dots in time order. */
  dots: DottedChartDot[];
  /** The x extent to scale against. Never zero-width. */
  domain: [number, number];
}

export interface ComputeDotsOptions {
  x?: DottedChartX;
  sort?: DottedChartSort;
}

function timeOfDay(ms: number): number {
  return ((ms % DAY_MS) + DAY_MS) % DAY_MS;
}

function timeOfWeek(ms: number): number {
  const shifted = ms + MONDAY_OFFSET_MS;
  return ((shifted % WEEK_MS) + WEEK_MS) % WEEK_MS;
}

function placeX(x: DottedChartX, at: number, caseStart: number): number {
  switch (x) {
    case "relative":
      return at - caseStart;
    case "relative_day":
      return timeOfDay(at);
    case "relative_week":
      return timeOfWeek(at);
    default:
      return at;
  }
}

/**
 * Build the dotted-chart model for a log.
 *
 * Deterministic: the same log and options always yield the same rows, dots and domain.
 * Events whose start could not be parsed are left out (they have no place on a time axis);
 * a case left with no placeable event is left out too.
 */
export function computeDots(log: AnyLog, options: ComputeDotsOptions = {}): DottedChartModel {
  const x = options.x ?? "absolute";
  const sort = options.sort ?? "start";
  const normalized = asNormalizedLog(log);

  const cases = normalized.cases
    .map((kase) => ({
      kase,
      events: kase.events.filter((event) => Number.isFinite(event.start)),
    }))
    .filter((entry) => entry.events.length > 0);

  const keyOf = (entry: (typeof cases)[number]): number => {
    const first = entry.events[0] as NormalizedEvent;
    const last = entry.events[entry.events.length - 1] as NormalizedEvent;
    const start = first.start;
    const end = Math.max(last.end, entry.kase.end);
    switch (sort) {
      case "end":
        return end;
      case "duration":
        return end - start;
      case "start_day":
        return timeOfDay(start);
      default:
        return start;
    }
  };

  // Decorate-sort-undecorate keeps the sort stable and each key computed once.
  const ordered = cases
    .map((entry, position) => ({ entry, position, key: keyOf(entry) }))
    .sort((a, b) => a.key - b.key || a.position - b.position);

  const rows: DottedChartRow[] = [];
  const dots: DottedChartDot[] = [];
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const { entry } of ordered) {
    const { kase, events } = entry;
    const rowIndex = rows.length;
    const first = events[0] as NormalizedEvent;
    const last = events[events.length - 1] as NormalizedEvent;
    const start = first.start;
    const end = Number.isFinite(kase.end) ? Math.max(kase.end, start) : start;
    const dotStart = dots.length;
    for (const event of events) {
      const value = placeX(x, event.start, start);
      if (value < min) min = value;
      if (value > max) max = value;
      dots.push({ kind: "dot", caseId: kase.caseId, rowIndex, event, x: value });
    }
    rows.push({
      kind: "row",
      caseId: kase.caseId,
      index: rowIndex,
      start,
      end,
      duration: end - start,
      eventCount: events.length,
      firstActivity: first.activity,
      lastActivity: last.activity,
      dotStart,
      dotEnd: dots.length,
    });
  }

  let domain: [number, number];
  if (x === "relative_day") domain = [0, DAY_MS];
  else if (x === "relative_week") domain = [0, WEEK_MS];
  else if (!Number.isFinite(min)) domain = [0, 1];
  else if (min === max) domain = [min - 1, max + 1];
  else domain = [min, max];

  return { x, sort, rows, dots, domain };
}

/**
 * Case ids of the rows a brush covers, in `rows` order.
 *
 * A row is covered when its index is in `[firstRow, lastRow]` (inclusive, either order) AND
 * at least one of its dots lies in the x range `[x0, x1]` (inclusive, either order). The
 * x test is what makes a brush over an empty stretch of time select nothing.
 */
export function casesInBrush(
  model: DottedChartModel,
  rowRange: readonly [number, number],
  xRange: readonly [number, number],
): string[] {
  const firstRow = Math.max(0, Math.min(rowRange[0], rowRange[1]));
  const lastRow = Math.min(model.rows.length - 1, Math.max(rowRange[0], rowRange[1]));
  const lo = Math.min(xRange[0], xRange[1]);
  const hi = Math.max(xRange[0], xRange[1]);
  const ids: string[] = [];
  for (let r = firstRow; r <= lastRow; r += 1) {
    const row = model.rows[r] as DottedChartRow;
    for (let d = row.dotStart; d < row.dotEnd; d += 1) {
      const value = (model.dots[d] as DottedChartDot).x;
      if (value >= lo && value <= hi) {
        ids.push(row.caseId);
        break;
      }
    }
  }
  return ids;
}

/** One entry of a {@link rankCategoryColors} legend. */
export interface DottedChartCategory extends ActivityColor {
  key: string;
  /** How many dots carry this category. */
  count: number;
}

/**
 * Colour arbitrary category keys (resources, a caller's own grouping) with the SAME budget
 * `activityColorScale` uses: the {@link ACTIVITY_COLOR_SLOTS} most frequent keys take
 * `--chart-1 …`, every other key shares {@link ACTIVITY_OTHER_TOKEN} and is flagged
 * `pattern: "other"`. Ranked by count descending, ties by key. Returns token names only.
 */
export function rankCategoryColors(keys: readonly string[]): DottedChartCategory[] {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([key, count], index) =>
      index < ACTIVITY_COLOR_SLOTS
        ? { key, count, token: `--chart-${index + 1}` }
        : { key, count, token: ACTIVITY_OTHER_TOKEN, pattern: "other" as const },
    );
}
