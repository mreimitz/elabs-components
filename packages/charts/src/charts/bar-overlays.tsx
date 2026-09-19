"use client";

import { useId } from "react";
import { HaloText } from "../marks";
import {
  chartCssVars,
  type ChartColorKeyItem,
  type ChartLegendEntry,
  type LineConfig,
} from "./chart-context";
import { useChartValueSetFormatter } from "./chart-formatters";
import type { BarStackLayout } from "./bar-stacking";
import { isBarGroupHeaderRow } from "./bar-groups";

/**
 * Per-bar layers a `BarChart` paints around its series (RM-113): the grey
 * `track` to the axis maximum, the muted `comparison` column behind each main
 * column, value / range `overlays` on top, and stack `showTotals` labels. Every
 * layer is ink — `aria-hidden` — and every value it reads is also a column in
 * the chart's data, so a `ChartFrame` table flip carries the same facts.
 */

/** A single-column marker per bar: a tick across the band, or a dot. */
export interface BarValueOverlay {
  kind: "value";
  key: string;
  label?: string;
  marker?: "tick" | "dot";
}

/** A span per bar between two columns — a confidence interval, a target band. */
export interface BarRangeOverlay {
  kind: "range";
  lowKey: string;
  highKey: string;
  label?: string;
  pattern?: "solid" | "stripes";
  opacity?: number;
}

export type BarOverlay = BarValueOverlay | BarRangeOverlay;

/** A muted prior-period column painted behind each main column. */
export interface BarComparison {
  key: string;
  label?: string;
}

/** What the grey label beside a `comparison` column says. */
export type BarComparisonLabel = "value" | "difference" | "none";

/** Range overlays draw light → dark in declaration order; value markers in ink. */
const RANGE_OVERLAY_INKS = ["var(--chart-mono-2)", "var(--chart-mono-4)", "var(--chart-mono-6)"];
const VALUE_OVERLAY_INK = chartCssVars.foreground;
const TRACK_INK = "var(--chart-mono-2)";
const COMPARISON_INK = "var(--chart-mono-3)";
const MINUS_SIGN = "−";
const LABEL_GAP = 6;

export function rangeOverlayInk(rangeIndex: number): string {
  return RANGE_OVERLAY_INKS[Math.min(rangeIndex, RANGE_OVERLAY_INKS.length - 1)] as string;
}

function num(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** The value extent every overlay / comparison column reaches, so the domain holds it. */
export function collectOverlayExtent(
  rows: readonly Record<string, unknown>[],
  overlays: readonly BarOverlay[] | undefined,
  comparison: BarComparison | undefined,
): { min: number; max: number } {
  let min = 0;
  let max = 0;
  const keys: string[] = [];
  for (const overlay of overlays ?? []) {
    if (overlay.kind === "range") keys.push(overlay.lowKey, overlay.highKey);
    else keys.push(overlay.key);
  }
  if (comparison) keys.push(comparison.key);
  for (const row of rows) {
    for (const key of keys) {
      const v = num(row, key);
      if (v === null) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return { min, max };
}

/** The legend entries a bar chart exposes: series, colour key, comparison, overlays. */
export function buildBarLegendItems({
  lines,
  colorKey,
  comparison,
  overlays,
}: {
  lines: readonly LineConfig[];
  colorKey?: readonly ChartColorKeyItem[];
  comparison?: BarComparison;
  overlays?: readonly BarOverlay[];
}): ChartLegendEntry[] {
  const items: ChartLegendEntry[] = [];
  if (colorKey && colorKey.length > 0) {
    for (const entry of colorKey) {
      items.push({
        key: `color:${entry.key}`,
        label: entry.label ?? entry.key,
        color: entry.color,
        kind: "color",
        marker: "bar",
      });
    }
  } else {
    for (const line of lines) {
      items.push({
        key: `series:${line.dataKey}`,
        label: line.dataKey,
        color: line.stroke,
        kind: "series",
        marker: "bar",
      });
    }
  }
  if (comparison) {
    items.push({
      key: `comparison:${comparison.key}`,
      label: comparison.label ?? comparison.key,
      color: COMPARISON_INK,
      kind: "comparison",
      marker: "bar",
    });
  }
  let rangeIndex = 0;
  (overlays ?? []).forEach((overlay, i) => {
    if (overlay.kind === "range") {
      items.push({
        key: `overlay:${i}`,
        label: overlay.label ?? `${overlay.lowKey}–${overlay.highKey}`,
        color: rangeOverlayInk(rangeIndex),
        kind: "overlay",
        marker: "range",
        pattern: overlay.pattern ?? "solid",
      });
      rangeIndex += 1;
    } else {
      items.push({
        key: `overlay:${i}`,
        label: overlay.label ?? overlay.key,
        color: VALUE_OVERLAY_INK,
        kind: "overlay",
        marker: overlay.marker ?? "tick",
      });
    }
  });
  return items;
}

/** Shared geometry every per-bar layer maps through. */
export interface BarLayerGeometry {
  rows: readonly Record<string, unknown>[];
  bandOf: (row: Record<string, unknown>) => number | undefined;
  /** Stable React key for a row — its category value. */
  rowKey: (row: Record<string, unknown>) => string;
  bandWidth: number;
  valueScale: (value: number) => number | undefined;
  isHorizontal: boolean;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A rect spanning `[lo, hi]` in value space across `[crossStart, crossStart + crossSize]`. */
function valueRect(
  geometry: BarLayerGeometry,
  lo: number,
  hi: number,
  crossStart: number,
  crossSize: number,
): Rect {
  const a = geometry.valueScale(Math.min(lo, hi)) ?? 0;
  const b = geometry.valueScale(Math.max(lo, hi)) ?? 0;
  const start = Math.min(a, b);
  const length = Math.abs(b - a);
  return geometry.isHorizontal
    ? { x: start, y: crossStart, width: length, height: crossSize }
    : { x: crossStart, y: start, width: crossSize, height: length };
}

function realRows(rows: readonly Record<string, unknown>[]) {
  return rows.filter((row) => !isBarGroupHeaderRow(row));
}

/** `track`: a `--chart-mono-2` bar from 0 to the axis maximum behind every bar. */
export function BarTrackLayer({ max, ...geometry }: BarLayerGeometry & { max: number }) {
  return (
    <g aria-hidden="true" data-slot="bar-chart-track">
      {realRows(geometry.rows).map((row) => {
        const band = geometry.bandOf(row);
        if (band === undefined) return null;
        const rect = valueRect(geometry, 0, max, band, geometry.bandWidth);
        return <rect fill={TRACK_INK} key={geometry.rowKey(row)} {...rect} />;
      })}
    </g>
  );
}

/** `comparison`: the muted column behind each main column, full band wide. */
export function BarComparisonLayer({
  comparison,
  ...geometry
}: BarLayerGeometry & { comparison: BarComparison }) {
  return (
    <g aria-hidden="true" data-slot="bar-chart-comparison">
      {realRows(geometry.rows).map((row) => {
        const band = geometry.bandOf(row);
        const value = num(row, comparison.key);
        if (band === undefined || value === null) return null;
        const rect = valueRect(geometry, 0, value, band, geometry.bandWidth);
        return <rect fill={COMPARISON_INK} key={geometry.rowKey(row)} {...rect} />;
      })}
    </g>
  );
}

function signed(value: number, format: (v: number) => string): string {
  if (value > 0) return `+${format(value)}`;
  if (value < 0) return `${MINUS_SIGN}${format(Math.abs(value))}`;
  return format(0);
}

/** Grey `comparisonLabel` text past the far end of each main / comparison pair. */
export function BarComparisonLabels({
  comparison,
  mainKey,
  mode,
  ...geometry
}: BarLayerGeometry & { comparison: BarComparison; mainKey: string; mode: BarComparisonLabel }) {
  const rows = realRows(geometry.rows);
  const pairs = rows.map((row) => ({
    row,
    main: num(row, mainKey),
    prev: num(row, comparison.key),
  }));
  const values = pairs.map(({ main, prev }) =>
    mode === "difference" && main !== null && prev !== null ? Math.abs(main - prev) : (prev ?? 0),
  );
  const format = useChartValueSetFormatter(values);
  if (mode === "none") return null;
  return (
    <g aria-hidden="true" data-slot="bar-chart-comparison-labels">
      {pairs.map(({ row, main, prev }) => {
        const band = geometry.bandOf(row);
        if (band === undefined || prev === null) return null;
        if (mode === "difference" && main === null) return null;
        const text = mode === "difference" ? signed((main as number) - prev, format) : format(prev);
        const far = Math.max(main ?? 0, prev, 0);
        const end = geometry.valueScale(far) ?? 0;
        const center = band + geometry.bandWidth / 2;
        return (
          <HaloText
            className="text-meta tabular-nums"
            data-slot="bar-chart-comparison-label"
            dominantBaseline={geometry.isHorizontal ? "middle" : "auto"}
            fill={chartCssVars.foregroundMuted}
            key={geometry.rowKey(row)}
            textAnchor={geometry.isHorizontal ? "start" : "middle"}
            x={geometry.isHorizontal ? end + LABEL_GAP : center}
            y={geometry.isHorizontal ? center : end - LABEL_GAP}
          >
            {text}
          </HaloText>
        );
      })}
    </g>
  );
}

/** Range overlays (light → dark, optional stripes) then value markers, per bar. */
export function BarOverlayLayer({
  overlays,
  ...geometry
}: BarLayerGeometry & { overlays: readonly BarOverlay[] }) {
  const scope = useId().replace(/:/g, "");
  const rows = realRows(geometry.rows);
  let rangeIndex = 0;
  return (
    <g aria-hidden="true" data-slot="bar-chart-overlays">
      {overlays.map((overlay, overlayIndex) => {
        const layerKey = `overlay-${overlayIndex}`;
        if (overlay.kind === "range") {
          const ink = rangeOverlayInk(rangeIndex);
          rangeIndex += 1;
          const patternId = `${scope}-stripes-${overlayIndex}`;
          const stripes = overlay.pattern === "stripes";
          return (
            <g
              data-overlay-kind="range"
              data-slot="bar-chart-overlay"
              key={layerKey}
              opacity={overlay.opacity ?? 1}
            >
              {stripes && (
                <defs>
                  <pattern
                    height={6}
                    id={patternId}
                    patternTransform="rotate(45)"
                    patternUnits="userSpaceOnUse"
                    width={6}
                  >
                    <rect fill={ink} height={6} width={3} />
                  </pattern>
                </defs>
              )}
              {rows.map((row) => {
                const band = geometry.bandOf(row);
                const lo = num(row, overlay.lowKey);
                const hi = num(row, overlay.highKey);
                if (band === undefined || lo === null || hi === null) return null;
                const rect = valueRect(geometry, lo, hi, band, geometry.bandWidth);
                return (
                  <rect
                    fill={stripes ? `url(#${patternId})` : ink}
                    key={geometry.rowKey(row)}
                    {...rect}
                  />
                );
              })}
            </g>
          );
        }
        const marker = overlay.marker ?? "tick";
        return (
          <g data-overlay-kind="value" data-slot="bar-chart-overlay" key={layerKey}>
            {rows.map((row) => {
              const band = geometry.bandOf(row);
              const value = num(row, overlay.key);
              if (band === undefined || value === null) return null;
              const at = geometry.valueScale(value) ?? 0;
              const center = band + geometry.bandWidth / 2;
              const key = geometry.rowKey(row);
              if (marker === "dot") {
                const r = Math.max(2, Math.min(5, geometry.bandWidth / 3));
                return (
                  <circle
                    cx={geometry.isHorizontal ? at : center}
                    cy={geometry.isHorizontal ? center : at}
                    fill={VALUE_OVERLAY_INK}
                    key={key}
                    r={r}
                  />
                );
              }
              return geometry.isHorizontal ? (
                <rect
                  fill={VALUE_OVERLAY_INK}
                  height={geometry.bandWidth}
                  key={key}
                  width={2}
                  x={at - 1}
                  y={band}
                />
              ) : (
                <rect
                  fill={VALUE_OVERLAY_INK}
                  height={2}
                  key={key}
                  width={geometry.bandWidth}
                  x={band}
                  y={at - 1}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

/** `showTotals`: the row total as a `HaloText` just past each stack's end. */
export function BarTotalsLayer({
  layout,
  ...geometry
}: BarLayerGeometry & { layout: BarStackLayout }) {
  const totals = geometry.rows.map((_, i) => layout.totals.get(i));
  const format = useChartValueSetFormatter(totals.map((t) => t?.total ?? 0));
  return (
    <g aria-hidden="true" data-slot="bar-chart-totals">
      {geometry.rows.map((row, i) => {
        const total = totals[i];
        const band = geometry.bandOf(row);
        if (!total || band === undefined || isBarGroupHeaderRow(row)) return null;
        const end = geometry.valueScale(total.end) ?? 0;
        const center = band + geometry.bandWidth / 2;
        const text =
          total.total < 0 ? `${MINUS_SIGN}${format(Math.abs(total.total))}` : format(total.total);
        return (
          <HaloText
            className="text-chart-value tabular-nums"
            data-slot="bar-chart-total"
            dominantBaseline={geometry.isHorizontal ? "middle" : "auto"}
            key={geometry.rowKey(row)}
            textAnchor={geometry.isHorizontal ? "start" : "middle"}
            x={geometry.isHorizontal ? end + LABEL_GAP : center}
            y={geometry.isHorizontal ? center : end - LABEL_GAP}
          >
            {text}
          </HaloText>
        );
      })}
    </g>
  );
}

/**
 * The `colorBy` key: one swatch + label per category (or numeric bucket),
 * as real text outside the aria-hidden plot so it reads to AT too.
 */
export function BarColorKey({ items }: { items: readonly ChartColorKeyItem[] }) {
  const numeric = items.map((item) => item.from ?? 0).concat(items.map((item) => item.to ?? 0));
  const format = useChartValueSetFormatter(numeric);
  return (
    <ul
      className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap gap-x-3 gap-y-0.5 text-meta text-muted-foreground"
      data-slot="bar-chart-color-key"
    >
      {items.map((item) => (
        <li className="flex items-center gap-1" key={item.key}>
          <span
            aria-hidden="true"
            className="inline-block size-2.5 rounded-xs"
            style={{ backgroundColor: item.color }}
          />
          {item.label ?? `${format(item.from ?? 0)}–${format(item.to ?? 0)}`}
        </li>
      ))}
    </ul>
  );
}
