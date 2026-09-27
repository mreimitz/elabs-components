/**
 * Pure bar layouts (RM-113): how a `BarChart` turns rows × series into value-space
 * extents, and how it orders its rows. No React, no scales — every function here
 * takes plain rows and returns plain numbers, so the geometry is unit-testable and
 * the chart only has to map `[lo, hi]` through its value scale.
 *
 * Extents are in VALUE space: raw units for `"stacked"` and `"diverging"`,
 * FRACTIONS (0–1) for `"percent"`. The value domain that holds them stays
 * zero-based in every mode (charts-honesty): `resolveStackDomain` returns
 * exactly `[0, 1]` for percent and hands the raw extent to the chart's own
 * `resolveBarValueDomain` otherwise.
 *
 * `insetStackSegment` (RM-164) is the one step after the scale: it cuts
 * `stackGap` out of a segment's pixel span, shared by `Bar` and `SeriesBar`.
 *
 * `BarChart` and `ComposedChart` share the rest of their stacking here too
 * (RM-182, review F14): the cumulative offsets (`cumulativeStackOffsets`) and
 * the percent stack's axis rewrite (`applyPercentStackAxes`, the one helper
 * that touches React elements: it clones the chart's `YAxis` children).
 */

import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

/** How a stacked `BarChart` lays its segments out. */
export type BarStackMode = "stacked" | "percent" | "diverging";

/** The public `stacked` prop: `true` is the plain stack, `false` groups. */
export type BarStacked = boolean | "percent" | "diverging";

/** Segment order inside one stack: as the series are declared, smallest first, largest first. */
export type BarStackOrder = "data" | "asc" | "desc";

export type BarSortDirection = "asc" | "desc";

/**
 * Row order: `"none"` keeps the data order, `"asc"`/`"desc"` sort by the row's
 * value (the stack total when stacked, else the first series), `{ by, dir }`
 * sorts by any numeric column.
 */
export type BarSort = "none" | BarSortDirection | { by: string; dir: BarSortDirection };

/** data index → series key → `[lo, hi]` in value space. */
export type BarStackExtents = Map<number, Map<string, readonly [number, number]>>;

export interface BarStackTotal {
  /** Sum of the row's numeric values, in raw units — what a totals label prints. */
  total: number;
  /** Where the stack ends in value space — where a totals label sits. */
  end: number;
}

export interface BarStackLayout {
  mode: BarStackMode;
  extents: BarStackExtents;
  totals: Map<number, BarStackTotal>;
  /** Lowest `lo` across every segment (0 when nothing goes below zero). */
  min: number;
  /** Highest `hi` across every segment (0 when nothing goes above zero). */
  max: number;
}

export interface BarStackInput {
  data: readonly Record<string, unknown>[];
  /** Series keys in declaration order. */
  keys: readonly string[];
  mode: BarStackMode;
  stackOrder?: BarStackOrder;
  /** `"diverging"` only — the series centred on the zero line (a Likert "Neutral"). */
  divergingCenter?: string;
}

/** `stacked` prop → layout mode, or `null` for grouped bars. */
export function resolveStackMode(stacked: BarStacked | undefined): BarStackMode | null {
  if (stacked === "percent" || stacked === "diverging") {
    return stacked;
  }
  return stacked ? "stacked" : null;
}

function numericValue(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function orderKeys(
  row: Record<string, unknown>,
  keys: readonly string[],
  stackOrder: BarStackOrder,
): string[] {
  if (stackOrder === "data") {
    return [...keys];
  }
  const sign = stackOrder === "asc" ? 1 : -1;
  // Stable: equal values keep their declaration order.
  return [...keys].sort(
    (a, b) => sign * ((numericValue(row, a) ?? 0) - (numericValue(row, b) ?? 0)),
  );
}

/**
 * Sign-split stack: positive segments grow up from 0, negative segments grow
 * down from 0, each in `order` — a diverging tower never cancels itself out.
 */
function stackSignSplit(
  row: Record<string, unknown>,
  order: readonly string[],
  scale: number,
): Map<string, readonly [number, number]> {
  const out = new Map<string, readonly [number, number]>();
  let pos = 0;
  let neg = 0;
  for (const key of order) {
    const value = numericValue(row, key);
    if (value === null) {
      continue;
    }
    const scaled = value * scale;
    if (scaled >= 0) {
      out.set(key, [pos, pos + scaled]);
      pos += scaled;
    } else {
      out.set(key, [neg + scaled, neg]);
      neg += scaled;
    }
  }
  return out;
}

/**
 * Likert stack: the `center` series straddles zero (half each side), the
 * series declared BEFORE it stack leftwards/downwards outward from its low
 * edge, the series declared AFTER it rightwards/upwards from its high edge.
 * No `center` (or one that names no series): the first half of the series go
 * left, the rest go right — an even-point scale with no neutral option.
 */
function stackLikert(
  row: Record<string, unknown>,
  keys: readonly string[],
  center: string | undefined,
): Map<string, readonly [number, number]> {
  const out = new Map<string, readonly [number, number]>();
  const centerIndex = center === undefined ? -1 : keys.indexOf(center);
  let leftKeys: readonly string[];
  let rightKeys: readonly string[];
  let low = 0;
  let high = 0;
  if (centerIndex >= 0) {
    const centerValue = Math.abs(numericValue(row, keys[centerIndex] as string) ?? 0);
    low = -centerValue / 2;
    high = centerValue / 2;
    out.set(keys[centerIndex] as string, [low, high]);
    leftKeys = keys.slice(0, centerIndex);
    rightKeys = keys.slice(centerIndex + 1);
  } else {
    const half = Math.floor(keys.length / 2);
    leftKeys = keys.slice(0, half);
    rightKeys = keys.slice(half);
  }
  // Walk the left side from the centre OUTWARD: the series nearest the centre
  // sits against it, the most extreme answer ends the bar.
  for (let i = leftKeys.length - 1; i >= 0; i--) {
    const key = leftKeys[i] as string;
    const value = numericValue(row, key);
    if (value === null) {
      continue;
    }
    const length = Math.abs(value);
    out.set(key, [low - length, low]);
    low -= length;
  }
  for (const key of rightKeys) {
    const value = numericValue(row, key);
    if (value === null) {
      continue;
    }
    const length = Math.abs(value);
    out.set(key, [high, high + length]);
    high += length;
  }
  return out;
}

/** Lay every row out for one stack mode. */
export function computeBarStackLayout({
  data,
  keys,
  mode,
  stackOrder = "data",
  divergingCenter,
}: BarStackInput): BarStackLayout {
  const extents: BarStackExtents = new Map();
  const totals = new Map<number, BarStackTotal>();
  let min = 0;
  let max = 0;

  data.forEach((row, index) => {
    let total = 0;
    let hasValue = false;
    for (const key of keys) {
      const value = numericValue(row, key);
      if (value !== null) {
        total += value;
        hasValue = true;
      }
    }
    if (!hasValue) {
      return;
    }

    let rowExtents: Map<string, readonly [number, number]>;
    if (mode === "diverging") {
      rowExtents = stackLikert(row, keys, divergingCenter);
    } else if (mode === "percent") {
      // Share of the row's POSITIVE total — a percentage of a signed sum is
      // not a share of anything, so negatives count as zero here.
      let positive = 0;
      for (const key of keys) {
        positive += Math.max(0, numericValue(row, key) ?? 0);
      }
      const clamped: Record<string, unknown> = {};
      for (const key of keys) {
        const value = numericValue(row, key);
        clamped[key] = value === null ? null : Math.max(0, value);
      }
      rowExtents = stackSignSplit(
        clamped,
        orderKeys(row, keys, stackOrder),
        positive > 0 ? 1 / positive : 0,
      );
    } else {
      rowExtents = stackSignSplit(row, orderKeys(row, keys, stackOrder), 1);
    }

    let end = 0;
    for (const [lo, hi] of rowExtents.values()) {
      if (lo < min) min = lo;
      if (hi > max) max = hi;
      if (hi > end) end = hi;
    }
    extents.set(index, rowExtents);
    totals.set(index, { total, end });
  });

  return { mode, extents, totals, min, max };
}

/** A stack's two outer ends in value space: the lowest and highest edge of any of its segments. */
export interface BarStackBounds {
  min: number;
  max: number;
}

/**
 * The outer ends of one row's stack. Each segment is `[from, to]` in value
 * space, in either order. The zero baseline always lies inside the bounds.
 */
export function stackBounds(segments: Iterable<readonly [number, number]>): BarStackBounds {
  let min = 0;
  let max = 0;
  for (const [a, b] of segments) {
    min = Math.min(min, a, b);
    max = Math.max(max, a, b);
  }
  return { min, max };
}

/**
 * The segments of one row of a CUMULATIVE stack, the plain `stacked` path that
 * adds each series onto a running total: every numeric value in `keys` runs
 * from its `offsets` entry to that entry plus the value.
 */
export function cumulativeStackSegments(
  row: Record<string, unknown>,
  keys: readonly string[],
  offsets: ReadonlyMap<string, number> | undefined,
): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  for (const key of keys) {
    const value = numericValue(row, key);
    if (value === null) {
      continue;
    }
    const offset = offsets?.get(key) ?? 0;
    out.push([offset, offset + value]);
  }
  return out;
}

/**
 * The offsets of a CUMULATIVE stack, per row index: where each series in `keys`
 * starts, which is the running total of the numeric values declared before it
 * (a non-numeric value adds nothing). A missing row gets no entry. One copy for
 * `BarChart` and `ComposedChart` (RM-182, review F14).
 */
export function cumulativeStackOffsets(
  data: readonly (Record<string, unknown> | null | undefined)[],
  keys: readonly string[],
): Map<number, Map<string, number>> {
  const offsets = new Map<number, Map<string, number>>();
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) {
      continue;
    }
    const pointOffsets = new Map<string, number>();
    let cumulative = 0;
    for (const key of keys) {
      pointOffsets.set(key, cumulative);
      const value = row[key];
      if (typeof value === "number") {
        cumulative += value;
      }
    }
    offsets.set(i, pointOffsets);
  }
  return offsets;
}

/** How `applyPercentStackAxes` treats a chart's direct children. */
export interface PercentStackAxesOptions {
  /**
   * Which `YAxis` children draw the percent stack. Unset: every one (`BarChart`);
   * `ComposedChart` passes only its default axis.
   */
  readonly isStackAxis?: (props: Readonly<Record<string, unknown>>) => boolean;
  /** Also pin the axis domain to `[0, 1]` unless it sets its own (`ComposedChart`). */
  readonly pinDomain?: boolean;
  /**
   * A `ChartTooltip` that set no `unit` or `valueFormat` prints plain numbers
   * (`ComposedChart`): its rows are the raw values, which the axis' percent
   * style would misprint.
   */
  readonly tooltipNumbers?: boolean;
}

/**
 * `stacked="percent"` draws in fraction space, so a direct `YAxis` child that set
 * no format of its own (`valueFormat`/`formatValue`) prints percent: "0.4" would
 * be a lie of omission. An explicit format always wins. `options` holds the
 * two things only `ComposedChart` does on top (RM-121): pin the axis to `[0, 1]`
 * and keep the tooltip's rows plain numbers.
 */
export function applyPercentStackAxes(
  children: ReactNode,
  options: PercentStackAxesOptions = {},
): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child) || typeof child.type !== "function") {
      return child;
    }
    const childType = child.type as { displayName?: string; name?: string };
    const name = childType.displayName || childType.name;
    const props = child.props as Readonly<Record<string, unknown>>;
    if (name === "YAxis") {
      if (options.isStackAxis && !options.isStackAxis(props)) {
        return child;
      }
      const ownFormat = props.valueFormat !== undefined || props.formatValue !== undefined;
      if (!options.pinDomain) {
        return ownFormat
          ? child
          : cloneElement(child as ReactElement<{ valueFormat?: string }>, {
              valueFormat: "percent",
            });
      }
      return cloneElement(child as ReactElement<{ domain?: unknown; valueFormat?: string }>, {
        domain: props.domain ?? [0, 1],
        ...(ownFormat ? {} : { valueFormat: "percent" as const }),
      });
    }
    if (options.tooltipNumbers && name === "ChartTooltip") {
      if (props.unit != null || props.valueFormat != null) {
        return child;
      }
      return cloneElement(child as ReactElement<{ valueFormat?: string }>, {
        valueFormat: "number",
      });
    }
    return child;
  });
}

/**
 * A segment edge that another segment of the same stack butts against. The
 * zero baseline is never one (a diverging stack's positive and negative towers
 * meet there, each with its own outer end), and neither is the stack's outer end.
 */
function isInternalStackEdge(edge: number, { min, max }: BarStackBounds): boolean {
  return edge !== 0 && edge > min && edge < max;
}

/**
 * `stackGap` (RM-164): where a stack segment's two ends land once the gap is
 * cut out of the stack. The gap is inset SYMMETRICALLY at INTERNAL boundaries
 * only, `gap / 2` from each of the two segments that meet there. The first
 * segment therefore still starts on the baseline and the last one still ends
 * at the scaled total, so the stack's length keeps encoding its value
 * (charts-honesty). A segment thinner than its insets collapses to zero
 * length, never to a negative one.
 *
 * @param edges The segment's two ends in value space, `[from, to]`.
 * @param pixels The same two ends in pixels, in the same order.
 * @param bounds The row's `stackBounds`.
 * @param gap The gap in px; `0` (or less) returns `pixels` unchanged.
 * @returns The two ends in pixels, in the same order as `pixels`.
 */
export function insetStackSegment(
  edges: readonly [number, number],
  pixels: readonly [number, number],
  bounds: BarStackBounds,
  gap: number,
): [number, number] {
  const [fromPx, toPx] = pixels;
  if (!(gap > 0)) {
    return [fromPx, toPx];
  }
  const half = gap / 2;
  const insetFrom = isInternalStackEdge(edges[0], bounds);
  const insetTo = isInternalStackEdge(edges[1], bounds);
  // Pixel direction from the `from` end to the `to` end (either axis, either sign).
  const direction = Math.sign(toPx - fromPx);
  const from = insetFrom ? fromPx + direction * half : fromPx;
  const to = insetTo ? toPx - direction * half : toPx;
  if ((to - from) * direction >= 0) {
    return [from, to];
  }
  // Thinner than its insets: collapse onto the point both insets move towards.
  // An outer end never moves, so a one-sided collapse lands on it.
  const point = insetFrom && insetTo ? (fromPx + toPx) / 2 : insetFrom ? toPx : fromPx;
  return [point, point];
}

/**
 * The value domain for a stack mode. Percent is EXACTLY `[0, 1]` — every
 * stack ends at the same pixel, which is the point of the mode. The other
 * modes return `null`: the caller resolves its zero-based domain from
 * `layout.min`/`layout.max` like any other bar extent.
 */
export function resolveStackDomain(layout: BarStackLayout | null): [number, number] | null {
  return layout?.mode === "percent" ? [0, 1] : null;
}

/** The value a row sorts by: its `by` column, the stack total, or the first series. */
function sortValue(
  row: Record<string, unknown>,
  sort: Exclude<BarSort, "none">,
  keys: readonly string[],
  stacked: boolean,
): number | null {
  if (typeof sort === "object") {
    return numericValue(row, sort.by);
  }
  if (stacked) {
    let total = 0;
    let any = false;
    for (const key of keys) {
      const value = numericValue(row, key);
      if (value !== null) {
        total += value;
        any = true;
      }
    }
    return any ? total : null;
  }
  const first = keys[0];
  return first === undefined ? null : numericValue(row, first);
}

export interface BarRowOrderInput {
  sort?: BarSort;
  reverse?: boolean;
  /** Series keys — the default sort value is the first key (or the stack total). */
  keys: readonly string[];
  stacked?: boolean;
}

/**
 * Sort (stable; rows with no numeric sort value sink to the end) and then
 * optionally reverse. `sort="none"` + `reverse=false` returns the SAME array,
 * so a chart that sets neither keeps its data identity.
 */
export function orderBarRows<T extends Record<string, unknown>>(
  rows: readonly T[],
  { sort = "none", reverse = false, keys, stacked = false }: BarRowOrderInput,
): readonly T[] {
  if (sort === "none" && !reverse) {
    return rows;
  }
  let out = [...rows];
  if (sort !== "none") {
    const dir = typeof sort === "object" ? sort.dir : sort;
    const sign = dir === "asc" ? 1 : -1;
    out = out
      .map((row, index) => ({ row, index, value: sortValue(row, sort, keys, stacked) }))
      .sort((a, b) => {
        if (a.value === null || b.value === null) {
          if (a.value === b.value) return a.index - b.index;
          return a.value === null ? 1 : -1;
        }
        return sign * (a.value - b.value) || a.index - b.index;
      })
      .map((entry) => entry.row);
  }
  if (reverse) {
    out.reverse();
  }
  return out;
}

/** Rows split by `groupBy`, groups in order of first appearance, rows keeping their order. */
export function groupBarRows<T extends Record<string, unknown>>(
  rows: readonly T[],
  groupBy: string,
): Array<{ name: string; rows: T[] }> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const raw = row[groupBy];
    const name = raw === undefined || raw === null ? "" : String(raw);
    const bucket = groups.get(name);
    if (bucket) {
      bucket.push(row);
    } else {
      groups.set(name, [row]);
    }
  }
  return [...groups].map(([name, groupRows]) => ({ name, rows: groupRows }));
}
