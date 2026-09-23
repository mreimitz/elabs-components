"use client";

/**
 * analytics/analytic-series-layer.tsx — the painter of `trend` / `window` /
 * `forecast` / `errorBars` derived series (RM-139, ADR 0040 §1).
 *
 * Mounted as a child of the container by the analytics host, so a time-series
 * shell classifies it with the series — inside the reveal clip, after the
 * marks — and it never animates on its own (reduced motion needs nothing
 * extra: the reveal clip already honours it). It draws on the family's OWN
 * scales, read from the chart context:
 *
 * - time-series / scatter: `xAccessor({ [xDataKey]: x })` → `xScale`, the
 *   series' `yAxisId` scale for the value;
 * - bar: the category's band centre (the series' own column when grouped),
 *   with the value on `x` for a horizontal chart.
 *
 * A path follows its measure's curve (a step curve reads as a straight model
 * instead); a trend always draws smooth. Bands use the same `Area` geometry as
 * `AreaBand`. Ink per ADR 0040: `--chart-foreground-muted`, dashed for a
 * model; only a `replace` window paints in its measure's series token.
 *
 * `aria-hidden` like every mark — the facts reach AT through the container's
 * `describeAnalytics` sentence, the legend and the tooltip row.
 */

import { curveMonotoneX } from "@visx/curve";
import { Area, LinePath } from "@visx/shape";
import { memo, useMemo } from "react";
import { type ChartStableContextValue, useChartStable } from "../chart-context";
import { resolveCurve } from "../curve-types";
import { DEFAULT_Y_AXIS_ID } from "../y-axis-scales";
import { useChartAnalytics } from "./analytics-context";
import type { DerivedPoint, DerivedSeries } from "./derived-series";
import { ErrorBars, type ErrorBarGeometry } from "./error-bars";

/** Band wash opacity — a quiet interval behind the model path. */
const BAND_OPACITY = 0.22;
/** `Bar`'s own default gap between grouped columns. */
const BAR_GROUP_GAP = 4;

interface Placed {
  p: DerivedPoint;
  at: number;
}

type Geometry = {
  /** Pixel position of a raw x along the category/x axis, or `undefined`. */
  at: (series: DerivedSeries, x: unknown) => number | undefined;
  /** The value scale of a series. */
  value: (series: DerivedSeries) => (v: number) => number | undefined;
  horizontal: boolean;
  bar: boolean;
};

function useGeometry(stable: ChartStableContextValue, xDataKey: string): Geometry {
  return useMemo<Geometry>(() => {
    const valueScaleOf = (series: DerivedSeries) => {
      const id =
        series.config.yAxisId == null || series.config.yAxisId === ""
          ? DEFAULT_Y_AXIS_ID
          : String(series.config.yAxisId);
      const scale = stable.yScales?.[id] ?? stable.yScale;
      return (v: number) => {
        const out = scale(v);
        return typeof out === "number" && Number.isFinite(out) ? out : undefined;
      };
    };
    if (stable.barScale && stable.barXAccessor) {
      const barScale = stable.barScale;
      const barXAccessor = stable.barXAccessor;
      const bandWidth = stable.bandWidth ?? barScale.bandwidth();
      const inset = stable.barCrossInset ?? 0;
      const lines = stable.lines;
      const stacked = Boolean(stable.stacked);
      return {
        horizontal: stable.orientation === "horizontal",
        bar: true,
        value: valueScaleOf,
        at: (series, x) => {
          const band = barScale(barXAccessor({ [xDataKey]: x }));
          if (band === undefined) return undefined;
          const usable = bandWidth * (1 - 2 * inset);
          const start = band + bandWidth * inset;
          const index = lines.findIndex((line) => line.dataKey === series.of);
          if (stacked || index < 0 || lines.length <= 1) return start + usable / 2;
          const gap = BAR_GROUP_GAP;
          const width = (usable - gap * (lines.length - 1)) / lines.length;
          return start + index * (width + gap) + width / 2;
        },
      };
    }
    return {
      horizontal: false,
      bar: false,
      value: valueScaleOf,
      at: (_series, x) => {
        if (x === undefined || x === null) return undefined;
        const date = stable.xAccessor({ [xDataKey]: x });
        const t = date instanceof Date ? date.getTime() : NaN;
        if (!Number.isFinite(t)) return undefined;
        const out = stable.xScale(date);
        return typeof out === "number" && Number.isFinite(out) ? out : undefined;
      },
    };
  }, [stable, xDataKey]);
}

/** A band-x horizon step ("+1") has no place on a category axis. */
function placeable(p: DerivedPoint): boolean {
  return !(p.horizon && typeof p.x === "string" && p.x.startsWith("+"));
}

/** Which pass to paint: bands under the series (`back`), paths and whiskers over them (`front`). */
export type AnalyticSeriesLayerPass = "back" | "front" | "all";

const AnalyticSeriesMark = memo(function AnalyticSeriesMark({
  series,
  geometry,
  curve,
  pass,
}: {
  series: DerivedSeries;
  geometry: Geometry;
  curve: ReturnType<typeof resolveCurve>;
  pass: AnalyticSeriesLayerPass;
}) {
  const valueOf = geometry.value(series);
  const placed = useMemo(() => {
    const out: Placed[] = [];
    for (const p of series.points) {
      if (!placeable(p)) continue;
      const at = geometry.at(series, p.x);
      if (at === undefined) continue;
      out.push({ p, at });
    }
    return out;
  }, [series, geometry]);

  const samples = useMemo(
    () => JSON.stringify(placed.filter(({ p }) => p.y !== null).map(({ p }) => [p.xNum, p.y])),
    [placed],
  );

  const common = {
    "aria-hidden": true as const,
    "data-analytic": series.id,
    "data-kind": series.kind,
    "data-slot": "analytic-series",
    "data-points": samples,
  };

  const withBand = series.band !== undefined && series.kind !== "window" && !series.whiskers;
  const bandData = placed.filter(
    ({ p }) => typeof p.lower === "number" && typeof p.upper === "number",
  );
  const pos = (v: number | null | undefined) => (typeof v === "number" ? (valueOf(v) ?? 0) : 0);

  // Back pass: the interval washes UNDER the measure it qualifies.
  if (pass === "back") {
    if (!withBand || geometry.horizontal || bandData.length < 2) return null;
    return (
      <g aria-hidden="true" data-analytic={series.id} data-slot="analytic-series-band-layer">
        <Area<Placed>
          curve={curve}
          data={bandData}
          data-slot="analytic-series-band"
          fill={series.color}
          fillOpacity={BAND_OPACITY}
          x={(d) => d.at}
          y0={(d) => pos(d.p.lower)}
          y1={(d) => pos(d.p.upper)}
        />
      </g>
    );
  }

  if (series.whiskers) {
    const bars: ErrorBarGeometry[] = [];
    for (const { p, at } of placed) {
      if (typeof p.lower !== "number" || typeof p.upper !== "number") continue;
      const from = valueOf(p.lower);
      const to = valueOf(p.upper);
      if (from === undefined || to === undefined) continue;
      bars.push({ at, from, to, x: String(p.xNum), low: p.lower, high: p.upper });
    }
    return (
      <g {...common}>
        <ErrorBars bars={bars} horizontal={geometry.horizontal} stroke={series.color} />
      </g>
    );
  }

  const lineData = placed.filter(({ p }) => p.y !== null);

  if (geometry.horizontal) {
    // A horizontal bar chart: categories down y, values along x.
    return (
      <g {...common}>
        <LinePath<Placed>
          curve={curve}
          data={lineData}
          stroke={series.color}
          strokeDasharray={series.dash}
          strokeWidth={series.config.strokeWidth}
          x={(d) => pos(d.p.y)}
          y={(d) => d.at}
        />
      </g>
    );
  }

  return (
    <g {...common}>
      {pass === "all" && withBand && bandData.length > 1 ? (
        <Area<Placed>
          curve={curve}
          data={bandData}
          data-slot="analytic-series-band"
          fill={series.color}
          fillOpacity={BAND_OPACITY}
          x={(d) => d.at}
          y0={(d) => pos(d.p.lower)}
          y1={(d) => pos(d.p.upper)}
        />
      ) : null}
      {series.kind === "errorBars" ? null : (
        <LinePath<Placed>
          curve={curve}
          data={lineData}
          data-slot="analytic-series-path"
          stroke={series.color}
          strokeDasharray={series.dash}
          strokeLinecap="round"
          strokeWidth={series.config.strokeWidth}
          x={(d) => d.at}
          y={(d) => pos(d.p.y)}
        />
      )}
    </g>
  );
});

/**
 * Draws every visible derived series of the enclosing container's
 * `analytics`. Renders nothing outside an analytics host.
 */
export function AnalyticSeriesLayer({ layer = "all" }: { layer?: AnalyticSeriesLayerPass } = {}) {
  const analytics = useChartAnalytics();
  const stable = useChartStable();
  const geometry = useGeometry(stable, analytics?.xDataKey ?? "date");
  if (!analytics || analytics.derived.length === 0) return null;
  // A bar chart grows its columns in place (no clip reveal): the whiskers wait
  // for the bars instead of floating over them mid-grow.
  if (geometry.bar && !stable.isLoaded) return null;
  // A toggled-off entry hides its series; toggling the MEASURE off hides every
  // overlay computed from it too (a trend of a hidden series explains nothing).
  const visible = analytics.derived.filter(
    (series) =>
      !analytics.paintedElsewhere.has(series.id) &&
      !analytics.hiddenDerived.has(series.key) &&
      !analytics.hiddenDerived.has(series.of),
  );
  if (visible.length === 0) return null;
  return (
    <g aria-hidden="true" data-layer={layer} data-slot="analytic-series-layer" pointerEvents="none">
      {visible.map((series) => {
        const source = analytics.curves[series.of];
        const resolved = resolveCurve(source ?? "monotone");
        const stepped = typeof source === "string" && source.startsWith("step");
        const curve =
          series.kind === "trend" || stepped || series.kind === "errorBars"
            ? curveMonotoneX
            : resolved;
        return (
          <AnalyticSeriesMark
            curve={curve}
            geometry={geometry}
            key={series.key}
            pass={layer}
            series={series}
          />
        );
      })}
    </g>
  );
}
AnalyticSeriesLayer.displayName = "AnalyticSeriesLayer";
