"use client";

/**
 * chart-navigator.tsx — `ChartNavigator`, the overview strip (RM-140, ADR 0040 §2).
 *
 * A 40 px strip (32 px at the narrow tier; 24 px as a plain `"bar"`) that lives
 * OUTSIDE a chart's `plotHeight`:
 *
 * - the SHADOW — `condenseOverview` min/max buckets of the pooled series, one
 *   `--chart-grid`-ink area (never the series ramp, never a re-render of the
 *   chart, no labels); omitted for `scrollbar="bar"`;
 * - the outside of the window veiled in `--chart-background` so what shows
 *   through sits at the shared `SELECTION_EXCLUDED_OPACITY`;
 * - the WINDOW — the selection compound outline (`--chart-foreground` band
 *   split by a `--chart-background` core);
 * - two `role="slider"` handles in a positioned sibling of the aria-hidden
 *   `<svg>` (`NavigatorHandles`), and a polite live region.
 *
 * Works for a `time` window (ms) and an `index` window (rows) alike; horizontal
 * is the default, `orientation="vertical"` serves category bars (RM-141).
 */

import {
  forwardRef,
  type HTMLAttributes,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn, useControllableState, useLocale } from "@elabs-ai/components-ui";
import { useChartBreakpoint } from "../chart-breakpoint";
import { chartCssVars } from "../chart-context";
import { getDateFormat } from "../chart-formatters";
import { CHART_HAIRLINE_WIDTH } from "../../chart-hairline";
import {
  SELECTED_OUTLINE_CORE_COLOR,
  SELECTED_OUTLINE_CORE_WIDTH,
  SELECTED_OUTLINE_COLOR,
  SELECTED_OUTLINE_WIDTH,
  SELECTION_EXCLUDED_OPACITY,
} from "../chart-selection";
import { condenseOverview, type OverviewBucket } from "./condense-overview";
import { type NavigatorEdge, NavigatorHandles } from "./navigator-handles";
import {
  clampWindow,
  defaultMinSpan,
  fromNumericWindow,
  initialWindow,
  medianStep,
  type NumericExtent,
  type NumericWindow,
  type PixelRange,
  toNumericWindow,
  valueToPixel,
  windowToPixels,
} from "./navigator-window";
import type { NavigatorChangeMeta, NavigatorWindow } from "./types";
import { useNavigatorGestures } from "./use-navigator-gestures";

/** Strip thickness (px) at the wide / medium tiers. */
export const NAVIGATOR_HEIGHT = 40;
/** Strip thickness (px) at the narrow tier. */
export const NAVIGATOR_HEIGHT_NARROW = 32;
/** Thickness (px) of `scrollbar="bar"` — a plain scrollbar, no shadow. */
export const NAVIGATOR_BAR_HEIGHT = 24;
/** Pixels per shadow bucket (the stock-chart library groups its navigator series at 2 px). */
export const NAVIGATOR_BUCKET_PX = 2;

/** The strip thickness for a style at a tier. */
export function navigatorThickness(
  scrollbar: "miniChart" | "bar",
  breakpoint: "narrow" | "medium" | "wide",
): number {
  if (scrollbar === "bar") return NAVIGATOR_BAR_HEIGHT;
  return breakpoint === "narrow" ? NAVIGATOR_HEIGHT_NARROW : NAVIGATOR_HEIGHT;
}

export interface ChartNavigatorStripProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue" | "children"
> {
  /** `time`: the extent and windows are Dates; `index`: row numbers (`end` exclusive). */
  kind: "time" | "index";
  /** The full data extent: `[firstDate, lastDate]` or `[0, rowCount]`. */
  extent: [Date, Date] | [number, number];
  /** Controlled window; `null` = the whole extent. */
  window?: NavigatorWindow | null;
  /** Initial window when uncontrolled. Default: the whole extent. */
  defaultWindow?: NavigatorWindow;
  onWindowChange?: (window: NavigatorWindow, meta: NavigatorChangeMeta) => void;
  /** Smallest window: ms (time) or rows (index). Default 5× median step / 3 rows. */
  minSpan?: number;
  /** Where the uncontrolled first window sits when only `minSpan`-free defaults apply. */
  align?: "start" | "end";
  /** The rows behind the shadow (and the median step for time). */
  data?: readonly Record<string, unknown>[];
  /** Series keys pooled into the shadow. */
  valueKeys?: readonly string[];
  /** A row's x (time kind). Default: `row.date`. Ignored for index. */
  xAccessor?: (row: Record<string, unknown>) => Date | number;
  /** Pool the stack total per row instead of each value. */
  stacked?: boolean;
  /** Default `"horizontal"`. `"vertical"` runs top → bottom (RM-141). */
  orientation?: "horizontal" | "vertical";
  /** `"miniChart"` (shadow + window, default) or `"bar"` (window only). */
  scrollbar?: "miniChart" | "bar";
  /** Main-axis length in px; measured from the element when omitted. */
  length?: number;
  /** Cross-axis thickness in px. Default per style and tier (40 / 32 / 24). */
  thickness?: number;
  /** Main-axis padding (px) so the window lines up with a plot's inner range. */
  inset?: { start?: number; end?: number };
  /** One arrow-key step: ms (time) or rows (index). Default: the median data step / 1 row. */
  step?: number;
}

function toNumberExtent(extent: [Date, Date] | [number, number]): NumericExtent {
  const a = extent[0] instanceof Date ? extent[0].getTime() : extent[0];
  const b = extent[1] instanceof Date ? extent[1].getTime() : extent[1];
  return a <= b ? [a, b] : [b, a];
}

const defaultTimeAccessor = (row: Record<string, unknown>): Date | number => {
  const v = row.date;
  return v instanceof Date ? v : new Date(v as string | number);
};

const toMs = (v: Date | number): number => (v instanceof Date ? v.getTime() : v);

/** An SVG path: one closed area per contiguous run of buckets with values. */
function shadowPath(
  buckets: readonly OverviewBucket[],
  extent: NumericExtent,
  range: PixelRange,
  thickness: number,
): string {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const b of buckets) {
    if (Number.isFinite(b.min) && b.min < lo) lo = b.min;
    if (Number.isFinite(b.max) && b.max > hi) hi = b.max;
  }
  if (lo === Number.POSITIVE_INFINITY) return "";
  const pad = 3;
  const inner = Math.max(1, thickness - pad * 2);
  const y = (v: number) => (hi === lo ? thickness / 2 : pad + ((hi - v) / (hi - lo)) * inner);
  const runs: OverviewBucket[][] = [];
  let run: OverviewBucket[] = [];
  for (const b of buckets) {
    if (Number.isFinite(b.min) && Number.isFinite(b.max)) run.push(b);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  const fmt = (n: number) => Math.round(n * 100) / 100;
  return runs
    .map((r) => {
      const top = r.map((b) => `${fmt(valueToPixel(b.x, extent, range))},${fmt(y(b.max))}`);
      const bottom = r
        .slice()
        .reverse()
        // A flat bucket still paints: at least 1 px between min and max.
        .map(
          (b) =>
            `${fmt(valueToPixel(b.x, extent, range))},${fmt(Math.max(y(b.min), y(b.max) + 1))}`,
        );
      if (r.length === 1) {
        const x = valueToPixel(r[0]!.x, extent, range);
        return `M${fmt(x - 0.5)},${fmt(y(r[0]!.max))}H${fmt(x + 0.5)}V${fmt(Math.max(y(r[0]!.min), y(r[0]!.max) + 1))}H${fmt(x - 0.5)}Z`;
      }
      return `M${top.join("L")}L${bottom.join("L")}Z`;
    })
    .join("");
}

export const ChartNavigator = forwardRef<HTMLDivElement, ChartNavigatorStripProps>(
  function ChartNavigator(
    {
      kind,
      extent: extentProp,
      window: windowProp,
      defaultWindow,
      onWindowChange,
      minSpan: minSpanProp,
      align = "start",
      data,
      valueKeys,
      xAccessor: xAccessorProp,
      stacked = false,
      orientation = "horizontal",
      scrollbar = "miniChart",
      length: lengthProp,
      thickness: thicknessProp,
      inset,
      step: stepProp,
      className,
      style,
      ...props
    },
    forwardedRef,
  ) {
    const { t, locale } = useLocale();
    const breakpoint = useChartBreakpoint();
    const vertical = orientation === "vertical";
    const thickness = thicknessProp ?? navigatorThickness(scrollbar, breakpoint);

    const extentLo = toNumberExtent(extentProp)[0];
    const extentHi = toNumberExtent(extentProp)[1];
    const extent = useMemo<NumericExtent>(() => [extentLo, extentHi], [extentLo, extentHi]);

    // Row x values in ms (time) — the median step drives minSpan and the arrow step.
    const xOf = xAccessorProp ?? defaultTimeAccessor;
    const times = useMemo(() => {
      if (kind !== "time" || !data) return [] as number[];
      return data.map((row) => toMs(xOf(row)));
    }, [data, kind, xOf]);
    const dataStep = useMemo(() => (kind === "index" ? 1 : medianStep(times)), [kind, times]);
    const minSpan = minSpanProp ?? defaultMinSpan(kind, times);
    const step =
      stepProp ?? (dataStep > 0 ? dataStep : Math.max(1e-9, (extent[1] - extent[0]) / 100));

    // Controlled / uncontrolled window, as numbers — the shared primitive: a
    // `window` prop locks the component controlled on mount; `null` (controlled,
    // "no window") shows the full extent.
    const [initialUncontrolled] = useState<NumericWindow>(() =>
      defaultWindow ? toNumericWindow(defaultWindow) : initialWindow(align, extent),
    );
    const [storedWindow, setStoredWindow] = useControllableState<NumericWindow | null>(
      windowProp === undefined ? undefined : windowProp ? toNumericWindow(windowProp) : null,
      initialUncontrolled,
    );
    const rawWindow: NumericWindow = storedWindow ?? { start: extent[0], end: extent[1] };
    const window = clampWindow(rawWindow, extent, minSpan);

    // Main-axis length: the caller's, else measured.
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [measured, setMeasured] = useState(0);
    useLayoutEffect(() => {
      if (lengthProp != null) return undefined;
      const node = rootRef.current;
      if (!node) return undefined;
      const read = () => {
        const rect = node.getBoundingClientRect();
        setMeasured(vertical ? rect.height : rect.width);
      };
      read();
      if (typeof ResizeObserver === "undefined") return undefined;
      const observer = new ResizeObserver(read);
      observer.observe(node);
      return () => observer.disconnect();
    }, [lengthProp, vertical]);
    const length = lengthProp ?? measured;
    const insetStart = inset?.start ?? 0;
    const insetEnd = inset?.end ?? 0;
    const range = useMemo<PixelRange>(
      () => [insetStart, Math.max(insetStart, length - insetEnd)],
      [insetStart, insetEnd, length],
    );

    const valueText = useCallback(
      (value: number, edge: NavigatorEdge) => {
        if (kind === "index") {
          const total = Math.round(extent[1]);
          const row = edge === "start" ? Math.round(value) + 1 : Math.round(value);
          return t("charts.navigator.row", { row, total });
        }
        const withTime = dataStep > 0 && dataStep < 86_400_000;
        return getDateFormat(locale, {
          year: "numeric",
          month: "short",
          day: "numeric",
          ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
        }).format(new Date(value));
      },
      [dataStep, extent, kind, locale, t],
    );

    const [announcement, setAnnouncement] = useState("");
    const lastEmitted = useRef<NumericWindow>(window);
    lastEmitted.current = window;

    const emit = useCallback(
      (next: NumericWindow, meta: NavigatorChangeMeta) => {
        let settled = clampWindow(next, extent, minSpan);
        if (kind === "index") {
          const start = Math.round(settled.start);
          settled = clampWindow(
            { start, end: start + Math.round(settled.end - settled.start) },
            extent,
            minSpan,
          );
          settled = { start: Math.round(settled.start), end: Math.round(settled.end) };
        }
        if (meta.phase === "commit") {
          setAnnouncement(
            t("charts.navigator.announce", {
              start: valueText(settled.start, "start"),
              end: valueText(settled.end, "end"),
            }),
          );
        }
        const prev = lastEmitted.current;
        if (meta.phase === "move" && prev.start === settled.start && prev.end === settled.end) {
          return;
        }
        setStoredWindow(settled);
        onWindowChange?.(fromNumericWindow(kind, settled), meta);
      },
      [extent, kind, minSpan, onWindowChange, setStoredWindow, t, valueText],
    );

    const gestures = useNavigatorGestures({
      extent,
      range,
      window,
      minSpan,
      orientation,
      onChange: emit,
    });

    // The shadow: memoised on the data and the bucket count only, so a drag
    // re-renders the strip without re-condensing (RM-140 performance gate).
    const bucketCount = Math.max(1, Math.floor((range[1] - range[0]) / NAVIGATOR_BUCKET_PX));
    const keys = valueKeys ?? [];
    const keysSignature = keys.join("\u0000");
    const buckets = useMemo(() => {
      if (scrollbar === "bar" || !data || data.length === 0 || keys.length === 0) return [];
      return condenseOverview(data, keys, bucketCount, {
        stacked,
        xAccessor: kind === "index" ? (_row, i) => i + 0.5 : (row) => toMs(xOf(row)),
      });
      // `keys` is tracked by its signature — a fresh array per render must not re-condense.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scrollbar, data, keysSignature, bucketCount, stacked, kind, xOf]);
    const shadow = useMemo(
      () => (buckets.length ? shadowPath(buckets, extent, range, thickness) : ""),
      [buckets, extent, range, thickness],
    );

    const { x0, x1 } = windowToPixels(window, extent, range);
    const outline = SELECTED_OUTLINE_WIDTH / 2;
    // Everything below is drawn horizontally (main axis = x); a vertical strip
    // swaps the axes with one transform.
    const swap = vertical ? "matrix(0 1 1 0 0 0)" : undefined;
    const veil = 1 - SELECTION_EXCLUDED_OPACITY;

    const setRoot = (node: HTMLDivElement | null) => {
      rootRef.current = node;
      gestures.surfaceRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    return (
      <div
        {...props}
        className={cn("relative select-none", className)}
        data-orientation={orientation}
        data-scrollbar={scrollbar}
        data-slot="chart-navigator"
        ref={setRoot}
        style={{
          ...(vertical ? { width: thickness } : { height: thickness }),
          ...(lengthProp != null
            ? vertical
              ? { height: lengthProp }
              : { width: lengthProp }
            : null),
          ...style,
        }}
      >
        <div
          className={cn(
            "absolute inset-0 touch-none",
            gestures.dragging === "window" ? "cursor-grabbing" : "cursor-grab",
          )}
          data-slot="chart-navigator-track"
          onPointerDown={gestures.onTrackPointerDown}
          {...gestures.pointerHandlers}
        >
          <svg aria-hidden="true" className="block size-full overflow-visible">
            <g transform={swap}>
              {shadow ? (
                <path d={shadow} data-slot="chart-navigator-shadow" fill={chartCssVars.grid} />
              ) : null}
              <rect
                data-slot="chart-navigator-veil"
                fill={chartCssVars.background}
                height={thickness}
                opacity={veil}
                width={Math.max(0, x0 - range[0])}
                x={range[0]}
                y={0}
              />
              <rect
                data-slot="chart-navigator-veil"
                fill={chartCssVars.background}
                height={thickness}
                opacity={veil}
                width={Math.max(0, range[1] - x1)}
                x={x1}
                y={0}
              />
              <rect
                data-slot="chart-navigator-frame"
                fill="none"
                height={thickness - CHART_HAIRLINE_WIDTH}
                stroke={chartCssVars.grid}
                strokeWidth={CHART_HAIRLINE_WIDTH}
                width={Math.max(0, range[1] - range[0] - CHART_HAIRLINE_WIDTH)}
                x={range[0] + CHART_HAIRLINE_WIDTH / 2}
                y={CHART_HAIRLINE_WIDTH / 2}
              />
              <g data-slot="chart-navigator-window">
                <rect
                  fill="none"
                  height={Math.max(0, thickness - SELECTED_OUTLINE_WIDTH)}
                  stroke={SELECTED_OUTLINE_COLOR}
                  strokeWidth={SELECTED_OUTLINE_WIDTH}
                  width={Math.max(0, x1 - x0 - SELECTED_OUTLINE_WIDTH)}
                  x={x0 + outline}
                  y={outline}
                />
                <rect
                  fill="none"
                  height={Math.max(0, thickness - SELECTED_OUTLINE_WIDTH)}
                  stroke={SELECTED_OUTLINE_CORE_COLOR}
                  strokeWidth={SELECTED_OUTLINE_CORE_WIDTH}
                  width={Math.max(0, x1 - x0 - SELECTED_OUTLINE_WIDTH)}
                  x={x0 + outline}
                  y={outline}
                />
              </g>
            </g>
          </svg>
        </div>
        <NavigatorHandles
          announcement={announcement}
          endLabel={t("charts.navigator.end")}
          extent={extent}
          label={t("charts.navigator.label")}
          minSpan={minSpan}
          onChange={emit}
          onHandlePointerDown={gestures.onHandlePointerDown}
          orientation={orientation}
          pointerHandlers={gestures.pointerHandlers}
          positions={{ start: x0, end: x1 }}
          startLabel={t("charts.navigator.start")}
          step={step}
          thickness={thickness}
          valueText={valueText}
          window={window}
        />
      </div>
    );
  },
);

ChartNavigator.displayName = "ChartNavigator";
