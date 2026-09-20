/**
 * waterfall-steps.ts — RM-122 pure step maths for `WaterfallChart`.
 *
 * Everything a waterfall's DATA needs before it ever reaches
 * `computeWaterfallRows` (the running-total geometry, unchanged, still in
 * `waterfall-chart.tsx`): differences ↔ running-totals conversion, subtotal
 * insertion by group, in-group sort, start/end endpoint options, and the
 * `zoomToDifferences` value-axis domain. No React, no DOM, no scales-as-state
 * — pure functions over `WaterfallDatum[]`/`WaterfallRow[]`, unit-testable
 * directly (see `waterfall-steps.test.ts`).
 */

import type { WaterfallDatum, WaterfallRow } from "./waterfall-chart";

// ── differences ↔ running totals ────────────────────────────────────────────

/** How `WaterfallChart data` values are given: signed deltas (default), or a
 * running total at every row. */
export type WaterfallDataFormat = "differences" | "runningTotals";

/** The running total AFTER each row, using the same reset rule
 * `computeWaterfallRows` uses (`"step"` adds to it, anything else resets it
 * to its own `value`) — shared by {@link resolveWaterfallData} and
 * {@link insertSubtotals} so both read one running total off the same data. */
function runningAfters(data: readonly WaterfallDatum[]): number[] {
  let running = 0;
  return data.map((d) => {
    running = (d.kind ?? "step") === "step" ? running + d.value : d.value;
    return running;
  });
}

/**
 * Converts a `"runningTotals"` fixture to the canonical `"differences"`
 * shape `computeWaterfallRows` expects: every `"step"` row's `value` becomes
 * the delta off the PREVIOUS row's running total (0 before the first row);
 * a `"total"`/`"subtotal"` row's `value` is already absolute and passes
 * through unchanged (it resets the running total, in both formats alike).
 * `"differences"` (the default) returns `data` untouched.
 */
export function resolveWaterfallData(
  data: readonly WaterfallDatum[],
  dataFormat: WaterfallDataFormat = "differences",
): WaterfallDatum[] {
  if (dataFormat === "differences") {
    return [...data];
  }
  let previousTotal = 0;
  return data.map((d) => {
    const kind = d.kind ?? "step";
    if (kind !== "step") {
      previousTotal = d.value;
      return d;
    }
    const delta = d.value - previousTotal;
    previousTotal = d.value;
    return { ...d, value: delta };
  });
}

// ── subtotals by group ───────────────────────────────────────────────────────

/**
 * Inserts a `kind: "subtotal"` row after each run of consecutive rows
 * sharing the same `groups[i]` value — RM-122 `subtotalBy`. Rows are grouped
 * by ADJACENCY (spreadsheet order), never by re-sorting. `groups[i]` is
 * `undefined` for a row outside any group (never gets a subtotal after it).
 * A row that is already a checkpoint (`"total"`/`"subtotal"`) never gets a
 * second subtotal appended right after it. The inserted row's `value` is the
 * running total AT that point (an absolute value, `computeWaterfallRows`
 * then draws it from zero like any other checkpoint) — computed by the same
 * {@link runningAfters} scan `computeWaterfallRows` itself performs, so the
 * two never disagree. `subtotalLabel` is a `"{group}"` template, e.g.
 * `"{group} total"` → `"Q1 total"`.
 */
export function insertSubtotals(
  data: readonly WaterfallDatum[],
  groups: ReadonlyArray<string | undefined>,
  subtotalLabel = "{group} subtotal",
): WaterfallDatum[] {
  const afters = runningAfters(data);
  const out: WaterfallDatum[] = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) {
      continue;
    }
    out.push(row);
    const group = groups[i];
    const isCheckpoint = (row.kind ?? "step") !== "step";
    const endsGroup = group !== undefined && group !== groups[i + 1];
    if (endsGroup && !isCheckpoint) {
      out.push({
        kind: "subtotal",
        label: subtotalLabel.replace("{group}", group),
        value: afters[i] ?? 0,
      });
    }
  }
  return out;
}

// ── sort within each checkpoint-bounded group ───────────────────────────────

/** `"data"` (default) keeps spreadsheet order; the other two stable-sort
 * `"step"` rows within each run bounded by a `"total"`/`"subtotal"`
 * checkpoint — a checkpoint row never moves, it is the boundary a run sorts
 * between, not a member of one. */
export type WaterfallSort = "data" | "increasesFirst" | "decreasesFirst";

function stepRank(sort: WaterfallSort, value: number): number {
  const isIncrease = value >= 0;
  if (sort === "increasesFirst") {
    return isIncrease ? 0 : 1;
  }
  return isIncrease ? 1 : 0;
}

/**
 * Reorders `"step"` rows within each subtotal group per {@link WaterfallSort}.
 * Ties (equal sign) keep their original relative order — `Array.prototype.sort`
 * is stable in every runtime this package targets.
 */
export function sortWaterfallSteps(
  data: readonly WaterfallDatum[],
  sort: WaterfallSort = "data",
): WaterfallDatum[] {
  if (sort === "data") {
    return [...data];
  }
  const out: WaterfallDatum[] = [];
  let run: WaterfallDatum[] = [];
  const flush = () => {
    out.push(...[...run].sort((a, b) => stepRank(sort, a.value) - stepRank(sort, b.value)));
    run = [];
  };
  for (const row of data) {
    if ((row.kind ?? "step") === "step") {
      run.push(row);
    } else {
      flush();
      out.push(row);
    }
  }
  flush();
  return out;
}

// ── start / end endpoints ───────────────────────────────────────────────────

/** Show/relabel the chart's own first (`start`) or last (`end`) row —
 * Datawrapper's "start and end columns with custom labels". */
export interface WaterfallEndpointOptions {
  /** Show this endpoint row. Default `true` — set `false` to drop it. */
  show?: boolean;
  /** Override its label. Default: the row's own `label`. */
  label?: string;
}

/** Applies {@link WaterfallEndpointOptions} to the true first/last row of
 * `data`, after every other transform (differences/subtotals/sort) has run. */
export function applyEndpoints(
  data: readonly WaterfallDatum[],
  start?: WaterfallEndpointOptions,
  end?: WaterfallEndpointOptions,
): WaterfallDatum[] {
  let out = [...data];
  if (start && out.length > 0) {
    if (start.show === false) {
      out = out.slice(1);
    } else if (start.label !== undefined) {
      const first = out[0];
      if (first) {
        out = [{ ...first, label: start.label }, ...out.slice(1)];
      }
    }
  }
  if (end && out.length > 0) {
    const lastIndex = out.length - 1;
    if (end.show === false) {
      out = out.slice(0, lastIndex);
    } else if (end.label !== undefined) {
      const last = out[lastIndex];
      if (last) {
        out = [...out.slice(0, lastIndex), { ...last, label: end.label }];
      }
    }
  }
  return out;
}

// ── zoom to differences ──────────────────────────────────────────────────────

/** {@link computeWaterfallZoomDomain}'s answer: whether the axis zoomed, and
 * the domain to draw it with either way (so a caller never branches twice). */
export interface WaterfallZoomResult {
  zoomed: boolean;
  domain: [number, number];
}

/**
 * Rounds `value` down to a "nice" step one order of magnitude finer than its
 * own leading digit (996,420 → 990,000; 347 → 340) — a friendlier zoomed-axis
 * floor than the exact data minimum. Never rounds below 0.
 */
export function roundDownNice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const stepSize = magnitude >= 10 ? magnitude / 10 : magnitude;
  return Math.floor(value / stepSize) * stepSize;
}

/**
 * The zoomed value-axis domain for `zoomToDifferences` (RM-122). Datawrapper's
 * own trigger, read literally: `min(totals) − 0 > max − min`, where `max −
 * min` is the full swing of every `"step"` row's own `base`/`top` (how far
 * the running total actually moves through the bridge) and `min(totals)` is
 * the smallest `"total"`/`"subtotal"` checkpoint's distance from zero. When a
 * checkpoint sits far above that swing — the ordinary shape of a real
 * financial bridge, where gross/net are large and each step is comparatively
 * small — the differences would draw as a sliver against a mostly-empty
 * zero-based axis, so the domain drops the zero baseline and starts at
 * {@link roundDownNice} of the steps' own floor instead.
 *
 * `zoomed: false` returns the ordinary zero-based `[0, max]` domain (the
 * caller's usual path); `zoomed: true` is the signal to render `"total"`/
 * `"subtotal"` rows as `QuietDot` points on a dashed stem instead of bars —
 * a bar's LENGTH must be zero-based (`charts-honesty`); a checkpoint's
 * absolute value, once the zero baseline is gone, can only honestly be a
 * POSITION (a point), never a length.
 */
/** Share of the steps' swing a zoomed domain adds at each end, so end labels stay in the plot. */
const ZOOM_LABEL_ROOM = 0.12;

export function computeWaterfallZoomDomain(rows: readonly WaterfallRow[]): WaterfallZoomResult {
  const stepRows = rows.filter((r) => r.kind === "step");
  const checkpointRows = rows.filter((r) => r.kind !== "step");
  const fallbackMax = Math.max(0, ...rows.map((r) => r.top));
  const fallback: WaterfallZoomResult = { domain: [0, fallbackMax], zoomed: false };
  if (stepRows.length === 0 || checkpointRows.length === 0) {
    return fallback;
  }
  const min = Math.min(...stepRows.map((r) => r.base));
  const max = Math.max(...stepRows.map((r) => r.top));
  const swing = max - min;
  const minTotal = Math.min(...checkpointRows.map((r) => Math.abs(r.after)));
  if (!(minTotal - 0 > swing)) {
    return fallback;
  }
  // Room for an outside label at either end: the extreme step no longer ends on the plot edge.
  const pad = swing * ZOOM_LABEL_ROOM;
  return { domain: [roundDownNice(min - pad), max + pad], zoomed: true };
}
