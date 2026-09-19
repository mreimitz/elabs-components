"use client";

import { type ReactNode, forwardRef, useId, useMemo } from "react";
import { scaleLinear } from "@visx/scale";
import { cn } from "@elabs-ai/components-ui";
import {
  HaloText,
  Leader,
  type LeaderPoint,
  QuietDot,
  UNIT_STACK_EMPHASIS,
  UnitStack,
} from "../marks";
import type { BarOrientation } from "./bar-chart";
import { BarChart } from "./bar-chart";
import type { ChartAnnotation } from "./annotations/annotation-types"; // Annotations — RM-111
import {
  useAnnotationLayoutScope,
  usePublishAnnotationObstacles,
} from "./annotations/annotation-layout-context"; // Annotations — RM-111
import { estimateTextWidth } from "./use-text-measurer"; // Annotations — RM-111
import { BarXAxis } from "./bar-x-axis";
import { BarYAxis } from "./bar-y-axis";
import { ChartA11yLabel, type ChartA11yProps } from "./chart-a11y"; // RM-122 zoomToDifferences a11y note
import { type Margin, useChart } from "./chart-context";
import type {
  ChartDatapointClickHandler,
  ChartDatapointLabel,
  ChartInteractionProps,
} from "./chart-datapoint";
import {
  type ChartDatapointTarget,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
import { useChartValueFormatter } from "./chart-formatters";
import { Grid } from "./grid";
import { ChartTooltip } from "./tooltip";
import { isPaletteFill, makeSeriesPattern, seriesPatternId } from "./series-pattern";
import { useHighDecoration } from "./use-high-decoration";
import { useResolvedRadius } from "./use-resolved-radius";
import type { ChartValueFormat } from "./value-format";
import { type ChartPlotHeight, type Responsive, warnChartOnce } from "./chart-breakpoint";
import {
  applyEndpoints,
  computeWaterfallZoomDomain,
  insertSubtotals,
  resolveWaterfallData,
  sortWaterfallSteps,
  type WaterfallDataFormat,
  type WaterfallEndpointOptions,
  type WaterfallSort,
} from "./waterfall-steps"; // RM-122

/**
 * WaterfallChart — RM-022.
 *
 * Gross → deductions → net, one bar per step, each one floating from the
 * running total the previous step left off, connected by a dashed hand-off
 * hairline. `"total"` rows (a subtotal, gross, net) draw from zero instead of
 * floating, and reset the running total — the F9 lieflat gallery's waterfall.
 *
 * Built on `BarChart` rather than a bespoke SVG scaffold: a single fake series
 * (`dataKey="__cumulative"`, never rendered) registers with `BarChart`'s own
 * `extractBarConfigs`/y-domain machinery so scales, axes, grid, tooltip
 * crosshair and the reveal/loading chrome are the same code every other bar
 * family uses. Only the per-row shape (asymmetric rounding, per-row color,
 * connectors, one keyboard target per step) is bespoke, in `WaterfallBars`.
 */

// ── Row model ────────────────────────────────────────────────────────────────

export interface WaterfallDatum {
  /** Category label for this step. */
  label: string;
  /**
   * Signed delta for a `"step"` row (added to/subtracted from the running
   * total), or the absolute value for a `"total"`/`"subtotal"` row (drawn
   * from zero).
   */
  value: number;
  /**
   * `"step"` (default) adds/subtracts from the running total. `"total"` and
   * `"subtotal"` (RM-122, `subtotalBy` — a group's own auto-inserted
   * checkpoint, styled with `totalFill` same as `"total"`) both draw from
   * zero and reset the running total to `value` — a gross/subtotal/net
   * checkpoint.
   */
  kind?: "step" | "total" | "subtotal";
  /**
   * Extra fields a `subtotalBy` group name can read off this row (RM-122) —
   * e.g. `{ label, value, quarter: "Q1" }` with `subtotalBy="quarter"`.
   * Never read for anything else.
   */
  [field: string]: unknown;
}

/** One computed waterfall row — the tooltip's `point` and a keyboard
 * datapoint's `datum` (see `ChartInteractionProps`). */
export interface WaterfallStep {
  index: number;
  label: string;
  kind: "step" | "total" | "subtotal";
  value: number;
  /** Running total entering this step. */
  before: number;
  /** Running total leaving this step. */
  after: number;
}

/** Exported ONLY so `computeWaterfallRows` — where the waterfall's actual
 * geometry lives (the running total, not the rendering) — is unit-testable
 * directly, without going through a jsdom render. Not part of the component's
 * documented public props surface. */
export interface WaterfallRow extends WaterfallStep {
  /** `min(before, after)` — the bar's lower edge value. */
  base: number;
  /** `max(before, after)` — the bar's upper edge value. */
  top: number;
  /** `after >= before` — which edge is the bar's "outer"/far end. */
  isIncrease: boolean;
  /** Internal-only field so this row also satisfies `extractBarConfigs`'s
   * y-domain scan without rendering a real `<Bar>`. */
  __cumulative: number;
}

/**
 * A finding drawn above one step and tied to it by a `Leader` — for calling
 * out the one or two steps that actually explain the bridge (e.g. "Price,
 * not volume, carried Q3"). Vertical orientation only: ignored under
 * `orientation="horizontal"`, where the outer margin runs along the value
 * axis rather than above the bars. A callout needs headroom of its own —
 * widen `margin.top` (e.g. 64) when using it, the same way a consumer
 * already does for any other in-chart label.
 */
export interface WaterfallCallout {
  /** Matches a `WaterfallDatum.label` — the step this callout names. */
  label: string;
  /** The finding, drawn above the step, e.g. "The main driver". */
  note: string;
}

/**
 * Value-label control for every row (RM-122) — Datawrapper's "show totals" /
 * "show differences". Given at all, it REPLACES `showValues`'s own default
 * label text/placement (default rendering, `labels` unset, is unaffected —
 * every published story keeps its byte-identical output).
 */
export interface WaterfallLabelsConfig {
  /** `"all"` labels every row; `"totalsOnly"` labels only a `"total"`/
   * `"subtotal"` checkpoint, leaving `"step"` rows unlabelled. */
  totals: "all" | "totalsOnly";
  /** A `"step"` row's own label: its signed value (`"absolute"`, default),
   * a signed percent of the running total it left off (`"percent"`, e.g.
   * `"+12.5 %"`), or `"none"`. Ignored when `totals: "totalsOnly"`. */
  differences?: "absolute" | "percent" | "none";
  /** `"outside"` (default) sits past the bar's far edge, matching
   * `showValues`'s own placement; `"inside"` sits just inside it. */
  placement?: "inside" | "outside";
  /** Paint the label in the row's own fill color instead of the neutral
   * `HaloText` ink. Default `false`. */
  matchColor?: boolean;
}

/** One connector's VALUE-space (not pixel) endpoints — the running-total
 * hand-off a `Leader` draws between adjacent rows. */
export interface WaterfallConnectorAnchor {
  /** The row it leaves — always that row's `after` (its far/outer edge, the
   * value the running total reached). NEVER its `top`: on an increasing row
   * `top === after` so the two are indistinguishable, but on a DECREASING
   * row `top` is the row's `before` (the bigger of the two), so anchoring to
   * `top` by mistake silently draws the hairline from the wrong edge. */
  from: number;
  /** The row it enters — that row's `before`, UNLESS it is a `"total"` row,
   * whose `before` is always 0 (a total draws from zero); a total's real
   * hand-off point is its own `after`. */
  to: number;
}

/**
 * The connectors' value-space anchors — a pure function of `rows` alone, so
 * the hand-off logic is unit-testable independent of scales/DOM. Exported and
 * consumed by `WaterfallBars` below instead of re-deriving `from`/`to` inline,
 * so the render path and the test assert the exact same computation.
 */
export function computeWaterfallConnectorAnchors(rows: WaterfallRow[]): WaterfallConnectorAnchor[] {
  const anchors: WaterfallConnectorAnchor[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const row = rows[i];
    const nextRow = rows[i + 1];
    if (!row || !nextRow) {
      continue;
    }
    anchors.push({
      from: row.after,
      to: nextRow.kind !== "step" ? nextRow.after : nextRow.before,
    });
  }
  return anchors;
}

/**
 * The running-total geometry — this IS the waterfall. Deliberately a pure
 * function of `data` alone (no scales, no DOM) so the property that makes a
 * waterfall a waterfall — a `"step"` row floats from the PREVIOUS row's
 * running total, a `"total"` row resets it — is unit-testable directly. See
 * `waterfall-chart.test.tsx`'s `computeWaterfallRows` suite: it exists because
 * this exact function was mutated (`before` hard-coded to 0) and 16 rendering
 * tests plus 6 story tests all stayed green.
 */
export function computeWaterfallRows(data: WaterfallDatum[]): WaterfallRow[] {
  let running = 0;
  return data.map((d, index) => {
    const kind = d.kind ?? "step";
    // A "total" AND a "subtotal" (RM-122) both draw from zero and reset the
    // running total — the only difference between the two is which fill they
    // paint with (both use `totalFill`; see `fillForRow`).
    const isCheckpoint = kind !== "step";
    const before = isCheckpoint ? 0 : running;
    const after = isCheckpoint ? d.value : running + d.value;
    running = after;
    const base = Math.min(before, after);
    const top = Math.max(before, after);
    return {
      after,
      base,
      before,
      index,
      isIncrease: after >= before,
      kind,
      label: d.label,
      top,
      value: d.value,
      __cumulative: top,
    };
  });
}

// ── Asymmetric per-corner rounding ──────────────────────────────────────────

interface CornerRadii {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

/** SVG path `d` for a rect with independently-rounded corners — `<Bar>`'s
 * `rx`/`ry` round all four uniformly, which a waterfall step can't use: only
 * the "far" edge (the running total's new side) is ever rounded. */
function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  r: CornerRadii,
): string {
  const tl = Math.max(0, Math.min(r.tl, width / 2, height / 2));
  const tr = Math.max(0, Math.min(r.tr, width / 2, height / 2));
  const br = Math.max(0, Math.min(r.br, width / 2, height / 2));
  const bl = Math.max(0, Math.min(r.bl, width / 2, height / 2));
  return [
    `M ${x + tl} ${y}`,
    `H ${x + width - tr}`,
    tr ? `A ${tr} ${tr} 0 0 1 ${x + width} ${y + tr}` : "",
    `V ${y + height - br}`,
    br ? `A ${br} ${br} 0 0 1 ${x + width - br} ${y + height}` : "",
    `H ${x + bl}`,
    bl ? `A ${bl} ${bl} 0 0 1 ${x} ${y + height - bl}` : "",
    `V ${y + tl}`,
    tl ? `A ${tl} ${tl} 0 0 1 ${x + tl} ${y}` : "",
    "Z",
  ]
    .filter(Boolean)
    .join(" ");
}

const DEFAULT_POSITIVE_FILL = "var(--chart-seq-6)";
const DEFAULT_NEGATIVE_FILL = "var(--chart-seq-3)";
const DEFAULT_TOTAL_FILL = "var(--chart-foreground)";
const EMPTY_WATERFALL_TARGETS: ChartDatapointTarget[] = [];

function fillForRow(
  row: WaterfallRow,
  positiveFill: string,
  negativeFill: string,
  totalFill: string,
): string {
  // "total" and "subtotal" (RM-122) share one fill — Acceptance: "subtotalBy
  // inserts … subtotal columns with the totals fill".
  if (row.kind !== "step") {
    return totalFill;
  }
  return row.isIncrease ? positiveFill : negativeFill;
}

/**
 * A real minus (`−`, U+2212), never `Intl`'s own ASCII hyphen — the same
 * convention the KPI card format helpers (`formatKpiDelta`) already use:
 * draw the sign yourself and format the ABSOLUTE value. `signStep` adds a
 * leading `+` for a positive STEP (a total is an absolute value, never
 * signed positive).
 */
function formatSigned(value: number, format: (v: number) => string, signStep: boolean): string {
  const sign = value < 0 ? "−" : signStep && value > 0 ? "+" : "";
  return `${sign}${format(Math.abs(value))}`;
}

/**
 * One row's value-label text (RM-122) — `labels` given wins over the plain
 * `showValues` default entirely (see {@link WaterfallLabelsConfig}); `labels`
 * unset falls back to the pre-RM-122 `formatSigned` call, byte-identical.
 * `percentFormat` renders a `"step"` row's delta as a percent of the running
 * total it left off (`row.before`) — undefined/0 `before` has no percent to
 * show, so it falls back to the absolute reading.
 */
function waterfallLabelText(
  row: WaterfallRow,
  showValues: boolean,
  labels: WaterfallLabelsConfig | undefined,
  format: (v: number) => string,
  percentFormat: (v: number) => string,
): string | null {
  const isCheckpoint = row.kind !== "step";
  if (!labels) {
    return showValues ? formatSigned(row.value, format, !isCheckpoint) : null;
  }
  if (isCheckpoint) {
    return formatSigned(row.value, format, false);
  }
  if (labels.totals === "totalsOnly" || labels.differences === "none") {
    return null;
  }
  if (labels.differences === "percent" && row.before !== 0) {
    const percent = (row.value / Math.abs(row.before)) * 100;
    return formatSigned(percent, percentFormat, true);
  }
  return formatSigned(row.value, format, true);
}

/**
 * The decoration pattern index a row's step draws with (ADR 0011, #257):
 * increase = series 0, decrease = series 1, total = series 2 — fixed by the
 * row's MEANING, so "up", "down" and "total" keep one texture each.
 */
function patternIndexForRow(row: WaterfallRow): number {
  if (row.kind !== "step") {
    return 2;
  }
  return row.isIncrease ? 0 : 1;
}

// ── Bars + connectors + labels ──────────────────────────────────────────────

interface WaterfallBarsProps {
  /** Unused — present only so this satisfies `extractBarConfigs`'s "any
   * direct child with a string `dataKey`" series-registration heuristic. */
  dataKey: string;
  rows: WaterfallRow[];
  positiveFill: string;
  negativeFill: string;
  totalFill: string;
  showValues: boolean;
  /** `false` draws none; `true`/`"thin"` the default hairline weight;
   * `"thick"` a heavier one (RM-122 "connector weight"). */
  connectors: boolean | "thin" | "thick";
  unit?: number;
  valueFormat?: ChartValueFormat;
  callouts?: WaterfallCallout[];
  /** Drop the zero baseline when a checkpoint sits far above the steps' own
   * swing (RM-122) — see `computeWaterfallZoomDomain`. */
  zoomToDifferences?: boolean;
  labels?: WaterfallLabelsConfig;
}

function WaterfallBars({
  rows,
  positiveFill,
  negativeFill,
  totalFill,
  showValues,
  connectors,
  unit,
  valueFormat,
  callouts,
  zoomToDifferences,
  labels,
}: WaterfallBarsProps) {
  const { barScale, bandWidth, yScale, margin, orientation } = useChart();
  const isHorizontal = orientation === "horizontal";
  const themeRadius = useResolvedRadius();
  const format = useChartValueFormatter(valueFormat);
  const percentFormat = useChartValueFormatter({
    decimals: 1,
    optionalDecimals: false,
    style: "number",
    suffix: " %",
  });
  const datapointsEnabled = useChartDatapointsEnabled();
  const activateDatapoint = useActivateDatapoint();
  const connectorWeight = connectors === "thick" ? 1.2 : 0.6;

  // RM-122 zoomToDifferences: a checkpoint far above the steps' own swing
  // gets a domain that drops the zero baseline instead of squeezing every
  // step into a sliver. `valueScale` below is the ONE place this domain
  // becomes pixels — every geometry read in this component goes through it,
  // never the raw context `yScale`, so the plot stays internally consistent.
  const zoom = useMemo(
    () =>
      zoomToDifferences
        ? computeWaterfallZoomDomain(rows)
        : { domain: [0, 0] as [number, number], zoomed: false },
    [zoomToDifferences, rows],
  );
  const valueScale = useMemo(() => {
    if (!zoom.zoomed) {
      return yScale;
    }
    // honesty:allow zoomToDifferences intentionally drops the zero baseline (RM-122): every "total"/"subtotal" row renders as a QuietDot point below, never a bar, so this non-zero-based domain never encodes a LENGTH — only a "step" row's delta (top - base) is drawn as a bar, and a delta's length is proportional under any linear domain, zero-based or not.
    return scaleLinear<number>({ domain: zoom.domain, range: yScale.range() });
  }, [zoom, yScale]);

  // Decoration pattern (ADR 0011, #257): under high decoration a palette step
  // fill becomes its kind's series pattern (see `patternIndexForRow`), so the
  // increase/decrease/total split survives without hue. An author's literal or
  // url() fill, and the countable `unit` rungs (strokes), are left as drawn.
  const high = useHighDecoration();
  const patternScope = useId().replace(/:/g, "");
  const patternFills = useMemo(() => {
    if (!high) {
      return [];
    }
    // Only the kinds actually drawn get a def — no orphan patterns.
    const drawn = new Set(rows.map(patternIndexForRow));
    return [positiveFill, negativeFill, totalFill]
      .map((color, index) => ({ color, index }))
      .filter(({ color, index }) => drawn.has(index) && isPaletteFill(color));
  }, [high, rows, positiveFill, negativeFill, totalFill]);
  const patternedIndices = useMemo(
    () => new Set(patternFills.map(({ index }) => index)),
    [patternFills],
  );

  const geometry = useMemo(() => {
    if (!barScale || !bandWidth) {
      return [];
    }
    return rows.map((row) => {
      const catPos = barScale(row.label) ?? 0;
      // A checkpoint (`"total"`/`"subtotal"`) row's own `base` is always 0
      // (`computeWaterfallRows`), which sits OUTSIDE a zoomed domain — reading
      // it through `valueScale` would extrapolate off the plot. Zoomed, a
      // checkpoint gets a small POINT box centred on its own value instead;
      // `isPoint` tells the render loop to draw a `QuietDot`, never a bar.
      const isPoint = zoom.zoomed && row.kind !== "step";
      if (isPoint) {
        const valuePx = valueScale(row.after);
        const size = 10;
        return isHorizontal
          ? {
              height: bandWidth,
              isPoint,
              row,
              valuePx,
              width: size,
              x: valuePx - size / 2,
              y: catPos,
            }
          : {
              height: size,
              isPoint,
              row,
              valuePx,
              width: bandWidth,
              x: catPos,
              y: valuePx - size / 2,
            };
      }
      const fromPx = valueScale(row.base);
      const toPx = valueScale(row.top);
      if (isHorizontal) {
        return {
          height: bandWidth,
          isPoint,
          row,
          valuePx: valueScale(row.after),
          width: Math.abs(toPx - fromPx),
          x: Math.min(fromPx, toPx),
          y: catPos,
        };
      }
      return {
        height: Math.abs(toPx - fromPx),
        isPoint,
        row,
        valuePx: valueScale(row.after),
        width: bandWidth,
        x: catPos,
        y: Math.min(fromPx, toPx),
      };
    });
  }, [rows, barScale, bandWidth, valueScale, isHorizontal, zoom]);

  // Annotations — RM-111: inside an annotated chart the value labels are
  // obstacles for annotation text. The boxes mirror the label placement below
  // (11px, weight 800, so the width estimate is widened).
  const annotated = useAnnotationLayoutScope();
  const valueLabelRects = useMemo(() => {
    if (!annotated || !showValues) return null;
    return geometry.map((g) => {
      const text = formatSigned(g.row.value, format, g.row.kind === "step");
      const width = estimateTextWidth(text, 11) * 1.15;
      if (isHorizontal) {
        const x = g.row.isIncrease ? g.x + g.width + 6 : g.x - 6 - width;
        return { x, y: g.y + g.height / 2 - 7, width, height: 14 };
      }
      const y = g.row.isIncrease ? g.y - 6 : g.y + g.height + 14;
      return { x: g.x + g.width / 2 - width / 2, y: y - 11, width, height: 14 };
    });
  }, [annotated, showValues, geometry, format, isHorizontal]);
  usePublishAnnotationObstacles("waterfall-values", valueLabelRects);

  const datapointTargets = useMemo<ChartDatapointTarget[]>(() => {
    if (!datapointsEnabled || geometry.length === 0) {
      return EMPTY_WATERFALL_TARGETS;
    }
    return geometry.map((g, i) => ({
      category: g.row.label,
      datum: g.row as unknown as Record<string, unknown>,
      id: `waterfall-step:${i}`,
      index: i,
      rect: padDatapointRect({
        height: g.height,
        width: g.width,
        x: g.x + margin.left,
        y: g.y + margin.top,
      }),
      seriesIndex: 0,
      value: g.row.value,
    }));
  }, [geometry, datapointsEnabled, margin]);
  useRegisterDatapointTargets("waterfall-steps", datapointTargets);

  const connectorEls = useMemo(() => {
    if (connectors === false || !barScale || !bandWidth) {
      return null;
    }
    const anchors = computeWaterfallConnectorAnchors(rows);
    const els: ReactNode[] = [];
    for (let i = 0; i < anchors.length; i++) {
      const row = rows[i];
      const nextRow = rows[i + 1];
      const anchor = anchors[i];
      if (!row || !nextRow || !anchor) {
        continue;
      }
      const fromCat = barScale(row.label) ?? 0;
      const toCat = barScale(nextRow.label) ?? 0;
      const fromValuePx = valueScale(anchor.from);
      const toValuePx = valueScale(anchor.to);
      const from: LeaderPoint = isHorizontal
        ? [fromValuePx, fromCat + bandWidth]
        : [fromCat + bandWidth, fromValuePx];
      const to: LeaderPoint = isHorizontal ? [toValuePx, toCat] : [toCat, toValuePx];
      els.push(
        <Leader
          dash="2 3"
          from={from}
          key={`waterfall-connector-${i}`}
          kind="elbow"
          strokeWidth={connectorWeight}
          to={to}
        />,
      );
    }
    return els;
  }, [rows, connectors, connectorWeight, barScale, bandWidth, valueScale, isHorizontal]);

  // Leader + HaloText — the same two marks `Marginalia` composes, spelled out
  // rather than composed: a `Marginalia` note is one of the two marks this
  // package treats as carrying a fact no other element restates (see
  // `.claude/rules/charts.md` § Marks), which is the wrong shape for a note
  // that only editorializes ("the main driver") about a value already drawn,
  // signed, beside the bar. `HaloText`'s own docs name exactly this use: "a
  // peak callout".
  const calloutEls = useMemo(() => {
    if (isHorizontal || !callouts?.length || geometry.length === 0) {
      return null;
    }
    return callouts.flatMap((callout) => {
      const g = geometry.find((entry) => entry.row.label === callout.label);
      if (!g) {
        return [];
      }
      // Anchored to THIS bar's own top, never the tallest bar on the chart —
      // a shared note height reads as floating furniture the moment another
      // step is taller (`.claude/rules/charts.md` § Marks: a leader must
      // visibly touch the thing it names).
      const anchorX = g.x + g.width / 2;
      const noteY = g.y - 22;
      const anchor: LeaderPoint = [anchorX, g.y];
      return [
        <g data-slot="waterfall-chart-callout" key={`waterfall-callout-${callout.label}`}>
          <Leader dash="1 3" from={anchor} kind="curve" to={[anchorX, noteY + 4]} />
          <HaloText
            data-slot="waterfall-chart-callout-note"
            fill="var(--chart-foreground-muted)"
            fontSize={10}
            fontStyle="italic"
            textAnchor="middle"
            x={anchorX}
            y={noteY}
          >
            {callout.note}
          </HaloText>
        </g>,
      ];
    });
  }, [callouts, geometry, isHorizontal]);

  return (
    <g data-slot="waterfall-chart-bars">
      {patternFills.length > 0 && (
        <defs>
          {patternFills.map(({ color, index }) =>
            makeSeriesPattern(index, seriesPatternId(index, patternScope), color),
          )}
        </defs>
      )}
      {geometry.map((g, i) => {
        const fill = fillForRow(g.row, positiveFill, negativeFill, totalFill);
        const rowPatternIndex = patternIndexForRow(g.row);
        const stepFill = patternedIndices.has(rowPatternIndex)
          ? `url(#${seriesPatternId(rowPatternIndex, patternScope)})`
          : fill;
        const target = datapointTargets[i];
        const onClick =
          activateDatapoint && target
            ? (event: React.MouseEvent) => activateDatapoint(target, event)
            : undefined;

        const roundTop = !isHorizontal && g.row.isIncrease;
        const roundBottom = !isHorizontal && !g.row.isIncrease;
        const roundLeft = isHorizontal && !g.row.isIncrease;
        const roundRight = isHorizontal && g.row.isIncrease;
        const r = Math.min(themeRadius, g.width / 2, g.height / 2);
        const corners: CornerRadii = {
          bl: roundBottom || roundLeft ? r : 0,
          br: roundBottom || roundRight ? r : 0,
          tl: roundTop || roundLeft ? r : 0,
          tr: roundTop || roundRight ? r : 0,
        };

        const stepValue = g.row.top - g.row.base;
        // Pitch from the VALUE SCALE (px per unit), not the step's own pixel
        // span — a span-derived pitch is worth a different amount in every
        // column and always understates the step by one unit (#241, shared
        // root cause with `bar.tsx`'s `unit` mode).
        const pixelSpan = isHorizontal ? g.width : g.height;
        const pxPerUnit = unit && stepValue > 0 ? (pixelSpan / stepValue) * unit : 0;
        // A zoomed POINT row (see `geometry` above) has no meaningful "step
        // value" to count rungs from — `unit` never applies to it.
        const unitCount =
          !g.isPoint && unit && unit > 0 ? Math.max(1, Math.floor(stepValue / unit)) : 0;

        const stemFloorPx = zoom.zoomed ? valueScale(zoom.domain[0]) : 0;
        const shape = g.isPoint ? (
          <>
            <Leader
              dash="1 3"
              from={
                isHorizontal ? [stemFloorPx, g.y + g.height / 2] : [g.x + g.width / 2, stemFloorPx]
              }
              kind="elbow"
              to={isHorizontal ? [g.valuePx, g.y + g.height / 2] : [g.x + g.width / 2, g.valuePx]}
            />
            <QuietDot
              cx={isHorizontal ? g.valuePx : g.x + g.width / 2}
              cy={isHorizontal ? g.y + g.height / 2 : g.valuePx}
              data-slot="waterfall-chart-total-point"
              fill={stepFill}
              onClick={onClick}
              size={6}
              style={onClick ? { cursor: "pointer" } : undefined}
            />
          </>
        ) : unitCount > 0 ? (
          <UnitStack
            direction={isHorizontal ? "right" : "up"}
            kind="rung"
            // Reserve headroom for the emphatic (every-5th) mark, which
            // draws UNIT_STACK_EMPHASIS× the ordinary cross-axis length, so
            // it never overruns into the neighbouring step's band.
            length={(isHorizontal ? g.height : g.width) / UNIT_STACK_EMPHASIS}
            n={unitCount}
            onClick={onClick}
            // Mark 0 sits one full pitch from the origin, so the top rung
            // lands at the step's own end (for an exact multiple of `unit`)
            // instead of one unit short of it.
            originOffset={1}
            seed={g.row.index}
            step={pxPerUnit}
            stroke={fill}
            style={onClick ? { cursor: "pointer" } : undefined}
            x={isHorizontal ? g.x : g.x + g.width / 2}
            y={isHorizontal ? g.y + g.height / 2 : g.y + g.height}
          />
        ) : (
          <path
            d={roundedRectPath(g.x, g.y, g.width, g.height, corners)}
            data-slot="waterfall-chart-step"
            fill={stepFill}
            onClick={onClick}
            style={onClick ? { cursor: "pointer" } : undefined}
          />
        );

        const labelText = waterfallLabelText(g.row, showValues, labels, format, percentFormat);

        // `labels.placement === "inside"` (RM-122) sits the label just INSIDE
        // the bar's far edge instead of past it; a POINT row has no "inside"
        // to sit in, so it keeps the outside placement either way.
        const inside = labels?.placement === "inside" && !g.isPoint;
        const labelX = isHorizontal
          ? roundRight
            ? g.x + g.width + (inside ? -6 : 6)
            : g.x + (inside ? 6 : -6)
          : g.x + g.width / 2;
        const labelY = isHorizontal
          ? g.y + g.height / 2
          : roundTop
            ? g.y + (inside ? 14 : -6)
            : g.y + g.height + (inside ? -6 : 14);
        const labelFill = labels?.matchColor ? fill : undefined;

        return (
          <g key={`waterfall-row-${g.row.index}`}>
            {shape}
            {labelText ? (
              <HaloText
                dominantBaseline={isHorizontal ? "middle" : undefined}
                fill={labelFill}
                fontSize={11}
                fontWeight={800}
                textAnchor={isHorizontal ? (roundRight !== inside ? "start" : "end") : "middle"}
                x={labelX}
                y={labelY}
              >
                {labelText}
              </HaloText>
            ) : null}
          </g>
        );
      })}
      {connectorEls}
      {calloutEls}
    </g>
  );
}

// ── Public component ────────────────────────────────────────────────────────

export interface WaterfallChartProps extends ChartInteractionProps<WaterfallStep> {
  /** Steps from gross to net — one row per bar. */
  data: WaterfallDatum[];
  /** Default `"vertical"`. */
  orientation?: BarOrientation;
  /** Signed value label on each step (`HaloText`, 800 weight). Default `true`. */
  showValues?: boolean;
  /** Dashed hand-off hairline between each step's end and the next step's
   * start: `false` draws none, `true`/`"thin"` the default weight, `"thick"`
   * a heavier one (RM-122). Default `true`. */
  connectors?: boolean | "thin" | "thick";
  /** `"differences"` (default): `data` values are signed deltas.
   * `"runningTotals"`: every row's `value` is the running total AT that row
   * — converted once, up front (RM-122 `waterfall-steps.ts`). */
  dataFormat?: WaterfallDataFormat;
  /** Auto-inserts a `kind: "subtotal"` checkpoint after each run of rows
   * sharing this field's value (RM-122) — e.g. `subtotalBy="quarter"` with
   * `{ label, value, quarter: "Q1" }` rows. Off by default. */
  subtotalBy?: string;
  /** The inserted subtotal row's label — a `"{group}"` template. Default
   * `"{group} subtotal"`. Ignored without `subtotalBy`. */
  subtotalLabel?: string;
  /** Reorders `"step"` rows within each subtotal group (RM-122). Default
   * `"data"` (spreadsheet order). */
  sort?: WaterfallSort;
  /** Show/relabel the chart's own first row (RM-122, "start column"). */
  start?: WaterfallEndpointOptions;
  /** Show/relabel the chart's own last row (RM-122, "end column"). */
  end?: WaterfallEndpointOptions;
  /** Drops the zero baseline when a checkpoint sits far above the steps' own
   * swing, drawing `"total"`/`"subtotal"` rows as points instead of bars
   * (RM-122; see `computeWaterfallZoomDomain`). Default `false`. */
  zoomToDifferences?: boolean;
  /** Per-row value-label control (RM-122) — replaces `showValues`'s plain
   * signed reading when given. See {@link WaterfallLabelsConfig}. */
  labels?: WaterfallLabelsConfig;
  /** The value-axis gridlines. Turn off when every bar already carries its
   * own value label (`showValues`) and an unlabelled gridline would only add
   * furniture with no tick to read it against. Default `true`. */
  grid?: boolean;
  /** Fill for an increasing step. Default `var(--chart-seq-6)`. */
  positiveFill?: string;
  /** Fill for a decreasing step. Default `var(--chart-seq-3)`. */
  negativeFill?: string;
  /** Fill for a `"total"` row. Default `var(--chart-foreground)`. */
  totalFill?: string;
  /** When set, render each bar as a counted `UnitStack` of rungs (the F9
   * look) instead of a solid capsule — one rung per `unit` of value. Off by
   * default. */
  unit?: number;
  /** Value/label format. Default: locale number. */
  valueFormat?: ChartValueFormat;
  /** The one or two steps that actually explain the bridge, named directly on
   * the chart (see {@link WaterfallCallout}). Default: none. */
  callouts?: WaterfallCallout[];
  /**
   * The plot's own height (ADR 0039): px, or `{ aspect }` (width ÷ height),
   * optionally per breakpoint. Default: 2 : 1, and 1.25 : 1 when narrow.
   */
  plotHeight?: Responsive<ChartPlotHeight>;
  /**
   * @deprecated Use `plotHeight` (`height={n}` is an alias for
   * `plotHeight={n}`); removed in 5.0.0.
   */
  height?: number;
  /** Chart margins. */
  margin?: Partial<Margin>;
  /** Additional class name for the container. */
  className?: string;
  /** Accessible name for the chart region. */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT. */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
}

/**
 * @dataShape a running total with signed steps into and out of it
 * @avoidWhen there is no meaningful running total — use diverging bars instead
 */
export const WaterfallChart = forwardRef<HTMLDivElement, WaterfallChartProps>(
  function WaterfallChart(
    {
      accessibleDescription,
      accessibleLabel,
      annotations, // Annotations — RM-111
      callouts,
      className,
      connectors = true,
      copyValueOnActivate,
      data,
      dataFormat = "differences",
      datapointLabel,
      end,
      grid = true,
      labels,
      plotHeight,
      height,
      margin,
      maxInteractiveDatapoints,
      negativeFill = DEFAULT_NEGATIVE_FILL,
      onDatapointClick,
      orientation = "vertical",
      positiveFill = DEFAULT_POSITIVE_FILL,
      showValues = true,
      sort = "data",
      start,
      subtotalBy,
      subtotalLabel,
      totalFill = DEFAULT_TOTAL_FILL,
      unit,
      valueFormat,
      zoomToDifferences,
    },
    ref,
  ) {
    if (height !== undefined) {
      warnChartOnce(
        "WaterfallChart.height",
        '[WaterfallChart] "height" is deprecated and will be removed in 5.0.0. Use "plotHeight".',
      );
    }
    // RM-122 data pipeline — differences/runningTotals → subtotals by group →
    // in-group sort → start/end endpoints → the running-total geometry
    // (`computeWaterfallRows`, unchanged). Every step is a no-op at its
    // default, so the pipeline is byte-identical to the pre-RM-122 single
    // `computeWaterfallRows(data)` call when none of these props are set.
    const resolvedRows = useMemo(() => {
      let resolved = resolveWaterfallData(data, dataFormat);
      if (subtotalBy) {
        const groups = data.map((d) => {
          const value = d[subtotalBy];
          return typeof value === "string" ? value : undefined;
        });
        resolved = insertSubtotals(resolved, groups, subtotalLabel);
      }
      resolved = sortWaterfallSteps(resolved, sort);
      resolved = applyEndpoints(resolved, start, end);
      return resolved;
    }, [data, dataFormat, subtotalBy, subtotalLabel, sort, start, end]);
    const rows = useMemo(() => computeWaterfallRows(resolvedRows), [resolvedRows]);
    const format = useChartValueFormatter(valueFormat);
    const isHorizontal = orientation === "horizontal";

    // `QuietDot` (RM-017) is aria-hidden — the duty to restate the fact it
    // draws falls on the container. `zoomToDifferences` is the only case
    // this chart ever renders one (a checkpoint as a point, not a bar), so
    // the note only exists — and only changes the DOM — when that actually
    // happens; every other row still reads through `BarChart`'s own text
    // alternative, unchanged.
    const zoomNote = zoomToDifferences && computeWaterfallZoomDomain(rows).zoomed;
    const zoomNoteDescId = useId();

    return (
      <div className={cn("w-full", className)} data-slot="waterfall-chart" ref={ref}>
        {zoomNote ? (
          <ChartA11yLabel
            descId={zoomNoteDescId}
            // i18n-exempt: RM-122 a11y-only note, not yet plumbed through a labels prop
            description="Totals render as points, not bars, because the axis is zoomed to the differences."
          />
        ) : null}
        <BarChart
          accessibleDescription={accessibleDescription}
          accessibleLabel={accessibleLabel}
          annotations={annotations} // Annotations — RM-111: BarChart paints, keys and describes them.
          className="w-full"
          plotHeight={plotHeight ?? height}
          copyValueOnActivate={copyValueOnActivate}
          data={rows as unknown as Record<string, unknown>[]}
          datapointLabel={datapointLabel as ChartDatapointLabel | undefined}
          margin={margin}
          maxInteractiveDatapoints={maxInteractiveDatapoints}
          onDatapointClick={onDatapointClick as ChartDatapointClickHandler | undefined}
          orientation={orientation}
          xDataKey="label"
        >
          {grid ? <Grid horizontal={!isHorizontal} vertical={isHorizontal} /> : null}
          <WaterfallBars
            callouts={callouts}
            connectors={connectors}
            dataKey="__cumulative"
            labels={labels}
            negativeFill={negativeFill}
            positiveFill={positiveFill}
            rows={rows}
            showValues={showValues}
            totalFill={totalFill}
            unit={unit}
            valueFormat={valueFormat}
            zoomToDifferences={zoomToDifferences}
          />
          {isHorizontal ? <BarYAxis /> : <BarXAxis />}
          <ChartTooltip
            rows={(point) => {
              const row = point as unknown as WaterfallRow;
              return [
                {
                  color: fillForRow(row, positiveFill, negativeFill, totalFill),
                  label: "Value",
                  value: formatSigned(row.value, format, row.kind === "step"),
                },
                {
                  color: "var(--chart-foreground-muted)",
                  label: "Before",
                  value: formatSigned(row.before, format, false),
                },
                {
                  color: "var(--chart-foreground-muted)",
                  label: "After",
                  value: formatSigned(row.after, format, false),
                },
              ];
            }}
            showDots={false}
          />
        </BarChart>
      </div>
    );
  },
);

WaterfallChart.displayName = "WaterfallChart";

// Annotations — RM-111
export interface WaterfallChartProps {
  /**
   * Declarative annotations in data units: text notes, ranges, reference lines,
   * row notes (a step's `label` is its category). Painted by the inner `BarChart`.
   */
  annotations?: readonly ChartAnnotation[];
}
