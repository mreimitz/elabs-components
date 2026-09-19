"use client";

import { motion, useSpring } from "motion/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type SpringConfig, useChartConfig } from "../chart-config-context";
import { chartCssVars, type LineConfig, useChart, useChartStable } from "../chart-context";
import { weekdayDateFmt } from "../chart-formatters";
import { useChartSeriesMode } from "../time-series-chart-shell";
import type { ChartValueFormat } from "../value-format";
import { DateTicker } from "./date-ticker";
import { ChartTooltipBox } from "./tooltip-box";
import {
  ChartTooltipContent,
  useChartTooltipValueFormat,
  type TooltipRow,
} from "./tooltip-content";
import { ChartTooltipDot } from "./tooltip-dot";
import { ChartTooltipInline } from "./tooltip-inline";
import { ChartTooltipIndicator } from "./tooltip-indicator";
import { ChartTooltipTable } from "./tooltip-table";
import { useTooltipPin } from "./use-tooltip-pin";

/** `ChartTooltip variant` (RM-119) — the box layout preset. */
export type ChartTooltipVariant = "rows" | "table" | "inline";

export interface ChartTooltipProps {
  /** Whether to show the date pill at bottom. Default: true */
  showDatePill?: boolean;
  /** Whether to show the vertical crosshair line. Default: true */
  showCrosshair?: boolean;
  /** Whether to show dots on the lines. Default: true */
  showDots?: boolean;
  /**
   * Color for the crosshair/indicator line. When a function, receives the hovered point
   * (e.g. for candlestick: match candle color from close vs open). Default: --chart-crosshair.
   */
  indicatorColor?: string | ((point: Record<string, unknown>) => string);
  /** Custom content renderer for the tooltip box */
  content?: (props: { point: Record<string, unknown>; index: number }) => React.ReactNode;
  /** Custom row renderer - return array of TooltipRow */
  rows?: (point: Record<string, unknown>) => TooltipRow[];
  /**
   * Box layout preset (RM-119). `"rows"` (default) is today's stacked
   * `ChartTooltipContent`. `"table"` renders `ChartTooltipTable` — one
   * column per series with a header row, the date in the `<caption>`
   * (Datawrapper's dual-axis / multi-series shape, `dw-charts.md` §2.22).
   * `"inline"` renders no box at all — `ChartTooltipInline` paints the
   * hovered (or `focus`-nearest) series' value directly at the mark with
   * `HaloText` (the bikes chart). Ignored when `content` is set — a custom
   * renderer already owns the whole box.
   */
  variant?: ChartTooltipVariant;
  /**
   * Drive RM-112's per-series dim (`SeriesHoverDim`) from the tooltip's OWN
   * nearest-series resolution: whichever series' y position is closest to
   * the pointer, at ANY x along the crosshair, counts as hovered — not only
   * a direct hover on that series' own 2px stroke. Works standalone: it
   * registers "focus requested" on the shared series-mode context, so the
   * dim fires with no `focusOnHover` prop on the `LineChart`/`AreaChart`
   * container (a container `focusOnHover` still works exactly as before,
   * and the two compose — either one turns the dim on). Also the default
   * target series for `variant="inline"`. Default false.
   */
  focus?: boolean;
  /**
   * Tap-to-pin (RM-119): on a coarse pointer, a tap keeps the tooltip open
   * instead of clearing the instant the finger lifts. A second tap on the
   * mark, `Esc`, or a tap outside the chart releases it (announced once via
   * `role="status" aria-live="polite"`). Default: `true` only when the
   * pointer is coarse (`(pointer: coarse)` media query); pass an explicit
   * boolean to force either way regardless of pointer type.
   */
  pin?: boolean;
  /**
   * Swap the tooltip box's own title for nothing — the hovered category
   * moves to the chart's OWN title instead (a `ChartFrame`/facet panel
   * integration point, RM-119; `.claude/rules/charts.md`). The date/category
   * is still available from `useChart().tooltipData` for that consumer;
   * this only stops `ChartTooltip` from ALSO printing it in its own box, so
   * the two surfaces never show the same fact twice. Default false.
   */
  valueInTitle?: boolean;
  /**
   * Override tooltip dot fill. When omitted and `rows` is set, dot colors match row colors.
   * When a function, receives the hovered point and line config.
   */
  dotColor?: string | ((point: Record<string, unknown>, line: LineConfig) => string);
  /** Additional content to show below rows (e.g., markers) */
  children?: React.ReactNode;
  /** Custom class name */
  className?: string;
  /** Per-chart override for the crosshair / dot / date-pill spring. */
  springConfig?: SpringConfig;
  /** Per-chart override for the floating-panel spring. */
  boxSpringConfig?: SpringConfig;
  /** Inline styles for the tooltip panel (background, blur, etc.). */
  panelStyle?: React.CSSProperties;
  /**
   * Unit text appended to every DEFAULT row's value (RM-109) — the same
   * `unit` `<YAxis>` paints on one tick. Set automatically from the chart's
   * own `<YAxis unit>` when unset (the shell threads it through); pass it
   * explicitly only to override. Ignored when `rows` is set — a custom row
   * builder owns its own `TooltipRow.unit` per row.
   */
  unit?: string;
  /**
   * STYLE to borrow from the chart's own `<YAxis valueFormat>` for DEFAULT
   * rows (RM-109) — a currency symbol, a percent sign — never abbreviation
   * (`ChartTooltipContent`'s doc). Set automatically from `<YAxis
   * valueFormat>` when unset; ignored when `rows` is set.
   */
  valueFormat?: ChartValueFormat;
  /** ISO 4217 code for `valueFormat`'s `style: "currency"`. */
  currency?: string;
}

interface ChartTooltipInnerProps extends ChartTooltipProps {
  container: HTMLElement;
}

/** SSR-safe: `(pointer: coarse)` — RM-119's default pin target (touch, not mouse). */
function useIsCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const query = window.matchMedia("(pointer: coarse)");
    setCoarse(query.matches);
    const handleChange = (event: MediaQueryListEvent) => setCoarse(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);
  return coarse;
}

const ChartTooltipInner = memo(function ChartTooltipInner({
  showDatePill = true,
  showCrosshair = true,
  showDots = true,
  indicatorColor: indicatorColorProp,
  content,
  rows: rowsRenderer,
  variant = "rows",
  focus = false,
  pin: pinProp,
  valueInTitle = false,
  dotColor: dotColorProp,
  children,
  className = "",
  container,
  springConfig,
  boxSpringConfig,
  panelStyle,
  unit,
  valueFormat,
  currency,
}: ChartTooltipInnerProps) {
  const {
    tooltipData: liveTooltipData,
    width,
    height,
    innerHeight,
    margin,
    columnWidth,
    lines,
    xAccessor,
    xScaleType,
    dateLabels,
    containerRef,
    orientation,
    barXAccessor,
  } = useChart();
  const { setHoveredKey, setFocusRequested } = useChartSeriesMode();

  const isHorizontal = orientation === "horizontal";
  const discreteInteraction = dateLabels.length > 60;

  // ── Touch pinning (RM-119) ──────────────────────────────────────────────
  // Keeps painting a FROZEN snapshot of the last live tooltip once pinned,
  // since the container's own `touchend`/`mouseleave` handlers
  // (`use-chart-interaction.ts`) clear the live one the instant the finger
  // lifts. `pendingSnapshotRef` is written synchronously inside the native
  // `touchend` listener below — before React's own clear can commit — so the
  // snapshot always reflects the last real hover, never a stale render.
  const isCoarsePointer = useIsCoarsePointer();
  const pinEnabled = pinProp ?? isCoarsePointer;
  const liveTooltipDataRef = useRef(liveTooltipData);
  useEffect(() => {
    liveTooltipDataRef.current = liveTooltipData;
  }, [liveTooltipData]);
  const pendingSnapshotRef = useRef(liveTooltipData);
  const [pinnedSnapshot, setPinnedSnapshot] = useState<typeof liveTooltipData>(null);
  const containerRefObj = useRef(containerRef.current);
  containerRefObj.current = containerRef.current;

  const { pinned, handleTap } = useTooltipPin({
    containerRef: containerRefObj,
    enabled: pinEnabled,
    onRelease: () => setPinnedSnapshot(null),
  });

  useEffect(() => {
    if (pinned) {
      setPinnedSnapshot(pendingSnapshotRef.current);
    }
  }, [pinned]);

  useEffect(() => {
    if (!pinEnabled) {
      return;
    }
    function handleTouchEnd() {
      if (!pinned) {
        pendingSnapshotRef.current = liveTooltipDataRef.current;
      }
      handleTap();
    }
    container.addEventListener("touchend", handleTouchEnd);
    return () => container.removeEventListener("touchend", handleTouchEnd);
  }, [container, pinEnabled, pinned, handleTap]);

  const tooltipData = pinnedSnapshot ?? liveTooltipData;

  const visible = tooltipData !== null;
  const x = tooltipData?.x ?? 0;
  const xWithMargin = x + margin.left;

  // For horizontal charts, get the y position from the first line's yPosition (center of bar)
  const firstLineDataKey = lines[0]?.dataKey;
  const firstLineY = firstLineDataKey ? (tooltipData?.yPositions[firstLineDataKey] ?? 0) : 0;
  const yWithMargin = firstLineY + margin.top;

  // ── `focus` nearest-series resolution (RM-119) ──────────────────────────
  // A local pointer-Y track, separate from the shared x-bisector `TooltipData`
  // — the crosshair already resolves the hovered ROW; this resolves WHICH
  // series' y is closest at that row, for `focus` and `variant="inline"`.
  const [pointerY, setPointerY] = useState<number | null>(null);
  const needsPointerY = (focus || variant === "inline") && !isHorizontal;
  useEffect(() => {
    if (!needsPointerY) {
      setPointerY(null);
      return;
    }
    function handlePointerMove(event: MouseEvent | TouchEvent) {
      const rect = container.getBoundingClientRect();
      const clientY = "touches" in event ? event.touches[0]?.clientY : event.clientY;
      if (clientY == null) {
        return;
      }
      setPointerY(clientY - rect.top);
    }
    container.addEventListener("mousemove", handlePointerMove);
    container.addEventListener("touchmove", handlePointerMove);
    return () => {
      container.removeEventListener("mousemove", handlePointerMove);
      container.removeEventListener("touchmove", handlePointerMove);
    };
  }, [container, needsPointerY]);

  const nearestSeriesKey = useMemo(() => {
    if (pointerY == null || !tooltipData) {
      return null;
    }
    let best: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const line of lines) {
      const y = tooltipData.yPositions[line.dataKey];
      if (y == null) {
        continue;
      }
      const distance = Math.abs(y + margin.top - pointerY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = line.dataKey;
      }
    }
    return best;
  }, [pointerY, tooltipData, lines, margin.top]);

  // Registers "focus requested" on the shared series-mode context so the
  // hover dim (`SeriesHoverDim`) fires even with no `focusOnHover` prop on
  // the container — `<ChartTooltip focus />` alone is enough.
  useEffect(() => {
    setFocusRequested(focus);
    return () => setFocusRequested(false);
  }, [focus, setFocusRequested]);

  useEffect(() => {
    if (!focus) {
      return;
    }
    setHoveredKey(visible ? nearestSeriesKey : null);
    // Clear on every dep change (not only unmount) — a stale `hoveredKey`
    // must never outlive the render that produced it (e.g. `focus` flips off
    // mid-hover).
    return () => setHoveredKey(null);
  }, [focus, visible, nearestSeriesKey, setHoveredKey]);

  const tooltipRows = useMemo(() => {
    if (!tooltipData) {
      return [];
    }

    if (rowsRenderer) {
      return rowsRenderer(tooltipData.point);
    }

    // Default: generate rows from registered lines. `unit` (RM-109) is
    // threaded from the chart's own `<YAxis unit>` by the shell, so a
    // series' tooltip value carries the SAME unit its axis tick does.
    return lines.map((line) => ({
      color: line.stroke,
      label: line.dataKey,
      value: (tooltipData.point[line.dataKey] as number) ?? 0,
      unit,
    }));
  }, [tooltipData, lines, rowsRenderer, unit]);

  const resolveDotColor = useMemo(() => {
    return (line: LineConfig, index: number): string => {
      if (rowsRenderer && tooltipRows[index]?.color) {
        return tooltipRows[index].color;
      }
      if (dotColorProp != null) {
        if (typeof dotColorProp === "function" && tooltipData) {
          return dotColorProp(tooltipData.point, line);
        }
        if (typeof dotColorProp === "string") {
          return dotColorProp;
        }
      }
      return line.stroke;
    };
  }, [dotColorProp, rowsRenderer, tooltipData, tooltipRows]);

  // Resolve indicator color (static or from hovered point)
  const indicatorColor = useMemo(() => {
    if (indicatorColorProp == null) {
      return chartCssVars.crosshair;
    }
    if (typeof indicatorColorProp === "function") {
      return tooltipData ? indicatorColorProp(tooltipData.point) : chartCssVars.crosshair;
    }
    return indicatorColorProp;
  }, [indicatorColorProp, tooltipData]);

  // Title from date or category
  const title = useMemo(() => {
    if (!tooltipData) {
      return undefined;
    }
    // For bar charts (horizontal or vertical), use the category name
    if (barXAccessor) {
      return barXAccessor(tooltipData.point);
    }
    // #352: on a band/linear axis `xAccessor` returns a synthetic positional
    // instant — formatting it as a date would print a meaningless calendar day.
    // The caller's own x value is the pre-computed label.
    if (xScaleType != null && xScaleType !== "time") {
      return dateLabels[tooltipData.index] ?? "";
    }
    // For line/area charts, use the date
    return weekdayDateFmt.format(xAccessor(tooltipData.point));
  }, [tooltipData, barXAccessor, dateLabels, xAccessor, xScaleType]);
  const boxTitle = valueInTitle ? undefined : title;

  // ── `variant="inline"` target (RM-119) ──────────────────────────────────
  const inlineLine = useMemo(() => {
    if (variant !== "inline") {
      return undefined;
    }
    const key = nearestSeriesKey ?? lines[0]?.dataKey;
    return lines.find((line) => line.dataKey === key);
  }, [variant, nearestSeriesKey, lines]);
  const inlineFormat = useChartTooltipValueFormat(valueFormat, currency);
  const inlineValue =
    tooltipData && inlineLine
      ? (tooltipData.point[inlineLine.dataKey] as number | undefined)
      : undefined;
  const inlineText =
    typeof inlineValue === "number"
      ? unit
        ? `${inlineFormat(inlineValue)} ${unit}`
        : inlineFormat(inlineValue)
      : undefined;

  // Announced once when a pin engages — `role="status"` fires on mount/change,
  // never on every pointer move (the box itself is `pointer-events-none` and
  // silent to AT while merely hovering).
  const pinnedAnnouncement = useMemo(() => {
    if (!(pinned && tooltipData)) {
      return null;
    }
    const valueText = tooltipRows
      .map(
        (row) =>
          `${row.label} ${typeof row.value === "number" ? inlineFormat(row.value) : row.value}`,
      )
      .join(", ");
    return title ? `${title}: ${valueText}` : valueText;
  }, [pinned, tooltipData, tooltipRows, title, inlineFormat]);

  const tooltipContent = (
    <>
      {/* Crosshair indicator - rendered as SVG overlay */}
      {showCrosshair && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          height="100%"
          width="100%"
        >
          <g transform={`translate(${margin.left},${margin.top})`}>
            <ChartTooltipIndicator
              animate={!discreteInteraction}
              colorEdge={indicatorColor}
              colorMid={indicatorColor}
              columnWidth={columnWidth}
              fadeEdges
              height={innerHeight}
              springConfig={springConfig}
              visible={visible}
              width="line"
              x={x}
            />
          </g>
        </svg>
      )}

      {/* Dots on bars/lines - show for vertical charts only */}
      {showDots && visible && !isHorizontal && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          height="100%"
          width="100%"
        >
          <g transform={`translate(${margin.left},${margin.top})`}>
            {lines.map((line, index) => (
              <ChartTooltipDot
                color={resolveDotColor(line, index)}
                key={line.dataKey}
                springConfig={springConfig}
                strokeColor={chartCssVars.background}
                visible={visible}
                x={tooltipData?.xPositions?.[line.dataKey] ?? x}
                y={tooltipData?.yPositions[line.dataKey] ?? 0}
              />
            ))}
          </g>
        </svg>
      )}

      {/* `variant="inline"` (RM-119): the value painted AT the mark, no box */}
      {variant === "inline" && visible && inlineLine && inlineText != null && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          height="100%"
          width="100%"
        >
          <g transform={`translate(${margin.left},${margin.top})`}>
            <ChartTooltipInline
              color={inlineLine.stroke}
              text={inlineText}
              x={tooltipData?.xPositions?.[inlineLine.dataKey] ?? x}
              y={tooltipData?.yPositions[inlineLine.dataKey] ?? 0}
            />
          </g>
        </svg>
      )}

      {/* Tooltip Box — `variant="inline"` has none */}
      {variant !== "inline" && (
        <ChartTooltipBox
          className={className}
          containerHeight={height}
          containerRef={containerRef}
          containerWidth={width}
          panelStyle={panelStyle}
          springConfig={boxSpringConfig}
          top={isHorizontal ? undefined : margin.top}
          visible={visible}
          x={xWithMargin}
          y={isHorizontal ? yWithMargin : margin.top}
        >
          {content && tooltipData
            ? content({
                point: tooltipData.point,
                index: tooltipData.index,
              })
            : !content &&
              (variant === "table" ? (
                <ChartTooltipTable
                  currency={currency}
                  rows={tooltipRows}
                  title={boxTitle}
                  valueFormat={valueFormat}
                />
              ) : (
                <ChartTooltipContent
                  currency={currency}
                  rows={tooltipRows}
                  title={boxTitle}
                  valueFormat={valueFormat}
                >
                  {children}
                </ChartTooltipContent>
              ))}
        </ChartTooltipBox>
      )}

      {/* Date/Category Ticker - only show for vertical charts */}
      <DatePillTracker
        currentIndex={tooltipData?.index ?? 0}
        discreteInteraction={discreteInteraction}
        enabled={showDatePill && !isHorizontal}
        labels={dateLabels}
        springConfig={springConfig}
        visible={visible}
        xWithMargin={xWithMargin}
      />

      {pinnedAnnouncement && (
        <div
          aria-live="polite"
          className="sr-only"
          data-slot="chart-tooltip-pin-status"
          role="status"
        >
          {pinnedAnnouncement}
        </div>
      )}
    </>
  );

  return createPortal(tooltipContent, container);
});

export function ChartTooltip(props: ChartTooltipProps) {
  const { containerRef } = useChartStable();
  const { interactions } = useChartConfig();
  const [mounted, setMounted] = useState(false);

  // Only render portals on client side after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const container = containerRef.current;
  // RM-072: `interactions.passive === false` removes hover feedback entirely.
  if (!(mounted && container && interactions.passive)) {
    return null;
  }

  return <ChartTooltipInner {...props} container={container} />;
}

ChartTooltip.displayName = "ChartTooltip";

interface DatePillTrackerProps {
  enabled: boolean;
  visible: boolean;
  labels: string[];
  currentIndex: number;
  xWithMargin: number;
  discreteInteraction: boolean;
  springConfig?: SpringConfig;
}

// Inner-only-on-visible so `useSpring` initializes at the real cursor x
// instead of `margin.left` on first hover.
function DatePillTracker(props: DatePillTrackerProps) {
  if (!(props.enabled && props.visible && props.labels.length > 0)) {
    return null;
  }
  return <DatePillTrackerInner {...props} />;
}

function DatePillTrackerInner({
  labels,
  currentIndex,
  xWithMargin,
  discreteInteraction,
  springConfig,
  visible,
}: DatePillTrackerProps) {
  const { tooltipSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipSpring;
  const animatedX = useSpring(xWithMargin, effectiveSpring);

  if (!discreteInteraction) {
    animatedX.set(xWithMargin);
  }

  useEffect(() => {
    animatedX.set(xWithMargin);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jump animatedX only when `visible` flips; per-frame sync happens above
  }, [animatedX, visible]);

  return (
    <motion.div
      className="pointer-events-none absolute z-50"
      style={{
        left: discreteInteraction ? xWithMargin : animatedX,
        transform: "translateX(-50%)",
        bottom: 4,
      }}
    >
      <DateTicker currentIndex={currentIndex} labels={labels} visible={visible} />
    </motion.div>
  );
}

export default ChartTooltip;
