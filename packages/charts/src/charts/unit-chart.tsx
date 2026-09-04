"use client";

/**
 * UnitChart (RM-024) — "one mark = one honest unit", lieflat's default
 * replacement for pie charts.
 *
 * Three layouts, one contract:
 * - `waffle` (G4 Dot Waffle) — a column-major grid, marks assigned to series
 *   in order.
 * - `field` (L14 Hundred Field) — a golden-angle phyllotaxis cluster per
 *   series, cluster area proportional to its share.
 * - `rows` (L15 Ballot Tally) — one tick row per series; rows may each sum
 *   past `total` (a multi-select survey).
 *
 * See `packages/charts/src/charts/unit-layouts.ts` for the pure geometry and
 * the rounding rule, and `docs/review/2026-09-04-lieflat-charts-gap-analysis.md`
 * §1(1) for the provenance.
 *
 * ## Interaction & a11y
 *
 * The SVG body is `aria-hidden` (every mark is decorative); a hover on any
 * mark of a series shows that series in a floating tooltip regardless of
 * whether the consumer wired `onDatapointClick`. Keyboard drill-down mounts
 * ONE target per SERIES, never per mark — a 1,000-mark field would otherwise
 * register 1,000 keyboard stops for a handful of real categories. A
 * `role="img"` summary lists every series' value and share for AT, and the
 * per-mark reveal is a CSS `transition-delay` stagger (never per-mark
 * `motion`), so a 1,000-mark stress case stays a single paint.
 */

import {
  type CSSProperties,
  forwardRef,
  type HTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@elabs-ai/components-ui";
import { Leader } from "../marks/leader";
import { UnitStack } from "../marks/unit-stack";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import { type ChartPalette, resolvePalette } from "./chart-context";
import type { ChartInteractionProps } from "./chart-datapoint";
import {
  ChartDatapointLayer,
  ChartDatapointProvider,
  type ChartDatapointTarget,
  padDatapointRect,
  useActivateDatapoint,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
import { intFmt } from "./chart-formatters";
import { ChartLegend, type LegendItem } from "./chart-legend";
import { ChartTooltipBox } from "./tooltip/tooltip-box";
import { ChartTooltipContent, type TooltipRow } from "./tooltip/tooltip-content";
import {
  buildUnitChartSummary,
  computeArithmetic,
  layoutField,
  layoutRows,
  layoutWaffle,
  type UnitChartDatum,
  type UnitMark,
  type UnitRect,
} from "./unit-layouts";

export type { UnitChartDatum } from "./unit-layouts";

/** Which of the three lieflat layouts to draw. */
export type UnitChartLayout = "waffle" | "field" | "rows";

/** The mark shape for `waffle`/`field` (`rows` always draws ticks via `UnitStack`). */
export type UnitChartMark = "dot" | "tick" | "square";

const ROW_HEIGHT = 28;
const ROW_LABEL_WIDTH = 96;
const ROW_VALUE_WIDTH = 48;

export interface UnitChartProps
  extends ChartInteractionProps, Omit<HTMLAttributes<HTMLDivElement>, "color"> {
  /** The series — one labeled quantity per row. */
  data: UnitChartDatum[];
  /** Which lieflat layout to draw. */
  layout: UnitChartLayout;
  /** What 100% of the marks represents. Default 100 (percent). Ignored by `rows`. */
  total?: number;
  /** Value per mark. Default 1 — a `unit={2}` chart draws one mark per two incidents. */
  unit?: number;
  /** "one dot = one person in a hundred" — rendered as a caption and folded into the a11y summary. */
  unitLabel?: string;
  /** Grid columns for `waffle`. Default 10. */
  columns?: number;
  /** Mark shape for `waffle`/`field`. Default `"dot"`. */
  mark?: UnitChartMark;
  /** Color family. Default categorical; degrades past 6 series (RM-018). */
  palette?: ChartPalette;
  /** Show the footer arithmetic ("41 + 35 + 12 + 12 = 100 · 2 rounded away"). Default `true`. Ignored by `rows`. */
  showArithmetic?: boolean;
  /** Sort series by value, descending, before laying out. Default `"none"` (caller order). */
  sort?: "desc" | "none";
  /** Accessible name for the chart region. */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT. */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
}

function markElement(
  mark: UnitChartMark,
  m: UnitMark,
  color: string,
  mounted: boolean,
): React.ReactNode {
  const style: CSSProperties = {
    opacity: mounted ? 1 : 0,
    transitionDelay: `${m.delayMs}ms`,
  };
  const cls = "transition-opacity duration-fast ease-standard motion-reduce:transition-none";
  if (mark === "square") {
    return (
      <rect
        className={cls}
        data-slot="unit-chart-mark"
        fill={color}
        height={m.size * 2}
        key={`${m.seriesIndex}:${m.positionInGroup}`}
        style={style}
        width={m.size * 2}
        x={m.x - m.size}
        y={m.y - m.size}
      />
    );
  }
  if (mark === "tick") {
    return (
      <line
        className={cls}
        data-slot="unit-chart-mark"
        key={`${m.seriesIndex}:${m.positionInGroup}`}
        stroke={color}
        strokeWidth={Math.max(1, m.size * 0.5)}
        style={style}
        x1={m.x}
        x2={m.x}
        y1={m.y - m.size}
        y2={m.y + m.size}
      />
    );
  }
  return (
    <circle
      className={cls}
      cx={m.x}
      cy={m.y}
      data-slot="unit-chart-mark"
      fill={color}
      key={`${m.seriesIndex}:${m.positionInGroup}`}
      r={m.size}
      style={style}
    />
  );
}

const EMPTY_UNIT_TARGETS: ChartDatapointTarget[] = [];

const UnitChartBody = forwardRef<HTMLDivElement, UnitChartProps>(function UnitChartBody(
  {
    data,
    layout,
    total = 100,
    unit = 1,
    unitLabel,
    columns = 10,
    mark = "dot",
    palette = "categorical",
    showArithmetic = true,
    sort = "none",
    className,
    style,
    accessibleLabel,
    accessibleDescription,
    // Consumed by the outer `UnitChart` wrapper (`ChartDatapointProvider`) —
    // named here only so they don't fall into `...rest` and leak onto the DOM
    // `<div>` as unknown attributes (see `FunnelChartBody`'s identical shape).
    onDatapointClick: _onDatapointClick,
    copyValueOnActivate: _copyValueOnActivate,
    datapointLabel: _datapointLabel,
    maxInteractiveDatapoints: _maxInteractiveDatapoints,
    ...rest
  }: UnitChartProps,
  forwardedRef,
) {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [forwardedRef],
  );

  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel, accessibleDescription);

  const displayData = useMemo(
    () => (sort === "desc" ? [...data].sort((a, b) => b.value - a.value) : data),
    [data, sort],
  );

  const colors = useMemo(
    () =>
      resolvePalette(palette, Math.max(displayData.length, 1), { explicit: palette !== undefined }),
    [palette, displayData.length],
  );

  const arithmetic = useMemo(
    () => computeArithmetic(displayData, unit, total),
    [displayData, unit, total],
  );

  const summary = useMemo(() => buildUnitChartSummary(displayData, total), [displayData, total]);

  const [sz, setSz] = useState({ w: 0, h: 0 });
  const measure = useCallback(() => {
    if (!internalRef.current) return;
    const { width: w, height: h } = internalRef.current.getBoundingClientRect();
    if (w > 0 && h > 0) setSz({ w, h });
  }, []);
  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (internalRef.current) ro.observe(internalRef.current);
    return () => ro.disconnect();
  }, [measure]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [hoveredSeries, setHoveredSeries] = useState<number | null>(null);

  const rowsGeom = useMemo(
    () =>
      layout === "rows"
        ? layoutRows({ data: displayData, unit, width: sz.w, rowHeight: ROW_HEIGHT })
        : null,
    [layout, displayData, unit, sz.w],
  );
  const waffleGeom = useMemo(
    () =>
      layout === "waffle" && sz.w > 0 && sz.h > 0
        ? layoutWaffle({ data: displayData, unit, total, columns, width: sz.w, height: sz.h })
        : null,
    [layout, displayData, unit, total, columns, sz.w, sz.h],
  );
  const fieldGeom = useMemo(
    () =>
      layout === "field" && sz.w > 0 && sz.h > 0
        ? layoutField({ data: displayData, unit, width: sz.w, height: sz.h })
        : null,
    [layout, displayData, unit, sz.w, sz.h],
  );

  const seriesRects: UnitRect[] = useMemo(
    () => waffleGeom?.seriesRects ?? fieldGeom?.seriesRects ?? rowsGeom?.seriesRects ?? [],
    [waffleGeom, fieldGeom, rowsGeom],
  );

  // Drill-down (#349): one keyboard target per SERIES, never per mark.
  const datapointsEnabled = useChartDatapointsEnabled();
  const activateDatapoint = useActivateDatapoint();
  const targets = useMemo(() => {
    if (!datapointsEnabled || seriesRects.length === 0) return EMPTY_UNIT_TARGETS;
    return displayData.map((d, i) => ({
      id: `unit:${i}`,
      index: i,
      seriesIndex: i,
      datum: d as unknown as Record<string, unknown>,
      value: d.value,
      category: d.label,
      rect: padDatapointRect(seriesRects[i] ?? { x: 0, y: 0, width: 0, height: 0 }),
    }));
  }, [datapointsEnabled, displayData, seriesRects]);
  useRegisterDatapointTargets("unit-series", targets);

  const rowsHeight = layout === "rows" ? Math.max(1, displayData.length) * ROW_HEIGHT : 0;

  if (displayData.length === 0) {
    return null;
  }

  const legendItems: LegendItem[] = displayData.map((d, i) => ({
    label: d.label,
    value: d.value,
    color: colors[i] ?? colors[colors.length - 1] ?? "var(--chart-1)",
    seriesIndex: i,
  }));

  const hoveredRect = hoveredSeries != null ? seriesRects[hoveredSeries] : undefined;
  const hoveredDatum = hoveredSeries != null ? displayData[hoveredSeries] : undefined;
  const tooltipRows: TooltipRow[] =
    hoveredDatum && hoveredSeries != null
      ? [
          {
            color: colors[hoveredSeries] ?? "var(--chart-1)",
            label: hoveredDatum.label,
            value: hoveredDatum.value,
          },
        ]
      : [];

  const seriesGroupProps = (i: number) => ({
    className: "cursor-pointer",
    "data-slot": "unit-chart-series",
    onClick: (event: React.MouseEvent) => {
      const target = targets[i];
      if (target) activateDatapoint?.(target, event);
    },
    onMouseEnter: () => setHoveredSeries(i),
    onMouseLeave: () => setHoveredSeries((current) => (current === i ? null : current)),
  });

  return (
    <div
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full select-none overflow-visible", className)}
      data-slot="unit-chart"
      ref={ref}
      role={role}
      style={{
        aspectRatio:
          layout === "waffle"
            ? `${columns} / ${Math.max(1, Math.ceil(total / Math.max(1, columns)))}`
            : layout === "field"
              ? "1 / 1"
              : undefined,
        height: layout === "rows" ? rowsHeight : undefined,
        ...style,
      }}
      tabIndex={tabIndex}
      {...rest}
    >
      <ChartA11yLabel descId={descId} description={accessibleDescription} />
      {/* The `role="img"` per-series summary — the required a11y contract, independent of `accessibleLabel`. */}
      <div
        className="sr-only"
        role="img"
        aria-label={unitLabel ? `${unitLabel}. ${summary}` : summary}
      />

      {layout === "rows" && sz.w > 0 && rowsGeom && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${Math.max(sz.w, 1)} ${rowsHeight}`}
        >
          {rowsGeom.rows.map((row) => {
            const d = displayData[row.seriesIndex];
            if (!d) return null;
            const tickWidth = Math.max(sz.w - ROW_LABEL_WIDTH - ROW_VALUE_WIDTH, 1);
            const step = row.count > 0 ? Math.min(6, Math.max(1.5, tickWidth / row.count)) : 3;
            return (
              <g key={row.seriesIndex}>
                <text
                  dominantBaseline="middle"
                  fill="var(--chart-foreground-muted)"
                  fontSize={12}
                  x={0}
                  y={row.y}
                >
                  {d.label}
                </text>
                <UnitStack
                  direction="right"
                  jitter={false}
                  kind="tick"
                  length={ROW_HEIGHT * 0.55}
                  markEvery={10}
                  n={row.count}
                  seed={row.seriesIndex}
                  step={step}
                  stroke={colors[row.seriesIndex] ?? "var(--chart-1)"}
                  x={ROW_LABEL_WIDTH}
                  y={row.y}
                />
                <text
                  dominantBaseline="middle"
                  fill="var(--chart-foreground)"
                  fontSize={13}
                  fontWeight={800}
                  textAnchor="end"
                  x={sz.w}
                  y={row.y}
                >
                  {intFmt(d.value)}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {layout !== "rows" && sz.w > 0 && sz.h > 0 && (
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          viewBox={`0 0 ${sz.w} ${sz.h}`}
        >
          {waffleGeom &&
            displayData.map((_, seriesIndex) => (
              <g key={seriesIndex} {...seriesGroupProps(seriesIndex)}>
                {waffleGeom.marks
                  .filter((m) => m.seriesIndex === seriesIndex)
                  .map((m) =>
                    markElement(mark, m, colors[seriesIndex] ?? "var(--chart-1)", mounted),
                  )}
              </g>
            ))}
          {fieldGeom &&
            fieldGeom.clusters.map((cluster) => {
              const d = displayData[cluster.seriesIndex];
              if (!d) return null;
              const labelAngle =
                fieldGeom.clusters.length <= 1
                  ? -Math.PI / 2
                  : (2 * Math.PI * cluster.seriesIndex) / fieldGeom.clusters.length - Math.PI / 2;
              const anchorR = Math.min(sz.w, sz.h) * 0.44;
              const anchorX = sz.w / 2 + anchorR * Math.cos(labelAngle);
              const anchorY = sz.h / 2 + anchorR * Math.sin(labelAngle);
              const rightSide = Math.cos(labelAngle) >= 0;
              return (
                <g key={cluster.seriesIndex} {...seriesGroupProps(cluster.seriesIndex)}>
                  {fieldGeom.clusters.length > 1 && (
                    <Leader
                      dash="1 3"
                      from={[cluster.cx, cluster.cy]}
                      kind="curve"
                      to={[anchorX, anchorY]}
                    />
                  )}
                  {fieldGeom.marks
                    .filter((m) => m.seriesIndex === cluster.seriesIndex)
                    .map((m) =>
                      markElement(
                        mark,
                        m,
                        colors[cluster.seriesIndex] ?? "var(--chart-1)",
                        mounted,
                      ),
                    )}
                  <text
                    dominantBaseline="middle"
                    fill="var(--chart-foreground)"
                    fontSize={12}
                    fontWeight={600}
                    textAnchor={rightSide ? "start" : "end"}
                    x={anchorX}
                    y={anchorY}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
        </svg>
      )}

      {hoveredRect && (
        <ChartTooltipBox
          containerHeight={layout === "rows" ? rowsHeight : sz.h}
          containerRef={internalRef}
          containerWidth={sz.w}
          visible
          x={hoveredRect.x + hoveredRect.width / 2}
          y={hoveredRect.y + hoveredRect.height / 2}
        >
          <ChartTooltipContent rows={tooltipRows} />
        </ChartTooltipBox>
      )}

      <ChartDatapointLayer />

      {layout !== "rows" && (unitLabel || showArithmetic) && (
        <div className="mt-2 space-y-0.5 text-center">
          {unitLabel && <p className="text-chart-label text-caption">{unitLabel}</p>}
          {showArithmetic && (
            <p className="text-chart-foreground-muted text-caption tabular-nums">
              {arithmetic.text}
            </p>
          )}
        </div>
      )}

      {layout === "waffle" && <ChartLegend className="mt-3" items={legendItems} />}
    </div>
  );
});
UnitChartBody.displayName = "UnitChartBody";

/**
 * `UnitChart` — draws `layout="waffle" | "field" | "rows"`. When
 * `onDatapointClick`/`copyValueOnActivate` is set the body is wrapped in a
 * `ChartDatapointProvider` so its series can register keyboard targets — the
 * provider has to sit ABOVE the component that registers (#349).
 */
export const UnitChart = forwardRef<HTMLDivElement, UnitChartProps>(function UnitChart(props, ref) {
  const { copyValueOnActivate, datapointLabel, maxInteractiveDatapoints, onDatapointClick } = props;
  if (!onDatapointClick && !copyValueOnActivate) {
    return <UnitChartBody {...props} ref={ref} />;
  }
  return (
    <ChartDatapointProvider
      copyValueOnActivate={copyValueOnActivate}
      datapointLabel={datapointLabel}
      maxInteractiveDatapoints={maxInteractiveDatapoints}
      onDatapointClick={onDatapointClick}
    >
      <UnitChartBody {...props} ref={ref} />
    </ChartDatapointProvider>
  );
});
UnitChart.displayName = "UnitChart";
