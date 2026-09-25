"use client";

/**
 * analytics/analytics-context.tsx — the container-side host of `analytics[]`
 * (RM-138 / RM-139).
 *
 * One hook, `useChartAnalyticsHost`, runs OUTSIDE the plot (beside the
 * annotation host in `with-chart-annotations.tsx`): it resolves every
 * computed `line`/`band` into annotation entries and every
 * `trend`/`window`/`forecast`/`errorBars` into a derived series, once. What it
 * publishes is read, inside the plot, by:
 *
 * - the shells' value-domain seams (`useAnalyticsExtents`) — `ifOverflow:
 *   "extend"` and every derived series' extent widen the value axis; a
 *   forecast's horizon widens the time-series x domain;
 * - `AnalyticSeriesLayer` — the painter of the derived series;
 * - `useContainerLegend` — derived legend entries after the real series, a
 *   `replace` window renaming its measure's entry, and the toggle state;
 * - `ChartTooltip` — one muted row per derived series;
 * - `ChartA11yLabel` — the `describeAnalytics` sentences.
 *
 * With `analytics` unset the host publishes nothing and the container renders
 * exactly as before.
 */

import {
  Children,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale } from "@elabs-ai/components-ui";
import type { ChartAnnotation } from "../annotations/annotation-types";
import { ChartAnalyticsDescriptionContext } from "../chart-a11y";
import { useChartValueFormatter } from "../chart-formatters";
import type { CurveAlias, CurveFactory } from "../curve-types";
import type { ChartValueFormat } from "../value-format";
import {
  type DerivedSeries,
  deriveAllSeries,
  derivedExtent,
  describeAnalytics,
  xLookupKey,
} from "./derived-series";
import {
  type AnalyticExtent,
  resolveAnalytics,
  type ResolvedAnalyticMark,
} from "./resolve-analytics";
import type { AnalyticRow, ChartAnalytic } from "./types";

/** What the host publishes to the plot. */
export interface ChartAnalyticsContextValue {
  derived: readonly DerivedSeries[];
  marks: readonly ResolvedAnalyticMark[];
  /** Value-axis extents the domain must include (`ifOverflow: "extend"` + derived series). */
  extents: readonly AnalyticExtent[];
  /** Forecast horizon x values (raw) the x domain must include. */
  horizonX: readonly unknown[];
  /** Source series a `replace` window stands in for — hidden from paint. */
  replacedKeys: ReadonlySet<string>;
  /** Derived series toggled off through an interactive legend. */
  hiddenDerived: ReadonlySet<string>;
  /** Called by the legend engine with its current hidden-key set. */
  syncHiddenKeys: (keys: ReadonlySet<string>) => void;
  /** Curve of each source series (a derived path follows its measure's curve). */
  curves: Readonly<Record<string, CurveFactory | CurveAlias | undefined>>;
  xDataKey: string;
  /** Derived series another painter already draws (the deprecated `Scatter trend` alias). */
  paintedElsewhere: ReadonlySet<string>;
  /**
   * `true` while a container legend that lists the derived series is on
   * screen. Without one (a family with no legend engine, `legend` unset, the
   * `xs` density) the derived layer names each series with an end tag instead,
   * so a computed line never reads as an anonymous dashed stroke.
   */
  legendVisible: boolean;
  /** Called by the legend engine with whether it currently renders. */
  reportLegendVisible: (visible: boolean) => void;
  /**
   * Plot-relative line boxes other in-plot labels occupy (a `ReferenceLine`'s
   * label) — the derived layer's end tags step around them.
   */
  occupied: readonly OccupiedLabelBox[];
  /** Register (or with `null`, withdraw) a label box under a stable id. */
  reportOccupied: (id: string, box: OccupiedLabelBox | null) => void;
}

/** A one-line in-plot label: its baseline `y` and horizontal extent, plot px. */
export interface OccupiedLabelBox {
  y: number;
  left: number;
  right: number;
}

const ChartAnalyticsContext = createContext<ChartAnalyticsContextValue | null>(null);

/** The enclosing container's analytics, or `null`. */
export function useChartAnalytics(): ChartAnalyticsContextValue | null {
  return useContext(ChartAnalyticsContext);
}

const NO_EXTENTS: readonly AnalyticExtent[] = [];
const EMPTY_SET: ReadonlySet<string> = new Set();
const NO_DASHES: ReadonlyMap<string, string> = new Map();

/** The value-domain extents the enclosing container's analytics ask for (stable empty when none). */
export function useAnalyticsExtents(): readonly AnalyticExtent[] {
  return useContext(ChartAnalyticsContext)?.extents ?? NO_EXTENTS;
}

const NO_HORIZON: readonly unknown[] = [];

/** Forecast horizon x values (raw) — the time-series shell widens its x domain to include them. */
export function useAnalyticsHorizonX(): readonly unknown[] {
  return useContext(ChartAnalyticsContext)?.horizonX ?? NO_HORIZON;
}

/** Measures a `replace` window stands in for — the shells skip painting them (RM-139). */
export function useAnalyticsReplacedKeys(): ReadonlySet<string> {
  return useContext(ChartAnalyticsContext)?.replacedKeys ?? EMPTY_SET;
}

/** A derived series' tooltip row (the shape of `TooltipRow`, pre-formatted). */
export interface AnalyticsTooltipRow {
  color: string;
  label: string;
  value: string;
  muted: boolean;
  dashed: boolean;
  /** The series' own dash rhythm, repeated on the swatch. */
  dash?: string;
}

/** One muted tooltip row per visible derived series at the hovered row (RM-139). */
export function useAnalyticsTooltipRows(
  point: Record<string, unknown> | null | undefined,
  format: (value: number) => string,
): AnalyticsTooltipRow[] {
  const ctx = useContext(ChartAnalyticsContext);
  return useMemo(() => {
    if (!ctx || !point || ctx.derived.length === 0) return [];
    const key = xLookupKey(point[ctx.xDataKey]);
    const rows: AnalyticsTooltipRow[] = [];
    for (const series of ctx.derived) {
      if (ctx.hiddenDerived.has(series.key) || ctx.hiddenDerived.has(series.of)) continue;
      const sample = series.byX.get(key);
      if (!sample) continue;
      let value: string | undefined;
      // One decimal beyond the measure's own — a model value, not float noise.
      const digits = series.precision + 1;
      const fmt = (v: number) => format(Number(v.toFixed(digits)));
      if (series.kind === "errorBars") {
        if (typeof sample.lower === "number" && typeof sample.upper === "number") {
          value = `${fmt(sample.lower)}–${fmt(sample.upper)}`;
        }
      } else if (typeof sample.y === "number") {
        value = fmt(sample.y);
        if (
          series.kind === "forecast" &&
          typeof sample.lower === "number" &&
          typeof sample.upper === "number"
        ) {
          value = `${value} (${fmt(sample.lower)}–${fmt(sample.upper)})`;
        }
      }
      if (value === undefined) continue;
      // A `replace` window IS the measure now: a full-ink row in its token.
      rows.push({
        color: series.color,
        label: series.name,
        value,
        muted: !series.replace,
        dashed: series.dash !== undefined,
        dash: series.dash,
      });
    }
    return rows;
  }, [ctx, point, format]);
}

// ── Host ─────────────────────────────────────────────────────────────────────

/** A series a container draws, read off its children. */
export interface AnalyticsSourceSeries {
  key: string;
  name?: string;
  color?: string;
  yAxisId?: string | number;
  curve?: CurveFactory | CurveAlias;
}

const NON_SERIES = new Set([
  "ChartTooltip",
  "XAxis",
  "YAxis",
  "Grid",
  "ReferenceLine",
  "ChartAnnotations",
]);

/** The first `<YAxis>` child's `valueFormat` / `currency` / `unit` (the value axis' notation). */
function findValueAxisFormat(
  children: ReactNode,
): { valueFormat?: ChartValueFormat; currency?: string; unit?: string } | undefined {
  let found: { valueFormat?: ChartValueFormat; currency?: string; unit?: string } | undefined;
  Children.forEach(children, (child) => {
    if (found || !isValidElement(child)) return;
    const type = child.type as { displayName?: string; name?: string };
    const name = typeof child.type === "function" ? type.displayName || type.name || "" : "";
    if (name !== "YAxis") return;
    const props = child.props as {
      valueFormat?: ChartValueFormat;
      currency?: string;
      unit?: string;
    };
    if (props.valueFormat != null || props.currency != null || props.unit != null) {
      found = { valueFormat: props.valueFormat, currency: props.currency, unit: props.unit };
    }
  });
  return found;
}

/** Every child with a string `dataKey`, in tree order (fragments walked). */
export function collectAnalyticsSeries(children: ReactNode): AnalyticsSourceSeries[] {
  const out: AnalyticsSourceSeries[] = [];
  const seen = new Set<string>();
  const visit = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      const type = child.type as { displayName?: string; name?: string };
      const name = typeof child.type === "function" ? type.displayName || type.name || "" : "";
      const props = child.props as {
        dataKey?: unknown;
        name?: unknown;
        stroke?: unknown;
        fill?: unknown;
        yAxisId?: string | number;
        curve?: CurveFactory | CurveAlias;
        children?: ReactNode;
      };
      if (!NON_SERIES.has(name) && typeof props.dataKey === "string" && props.dataKey) {
        if (!seen.has(props.dataKey)) {
          seen.add(props.dataKey);
          const color =
            typeof props.stroke === "string"
              ? props.stroke
              : typeof props.fill === "string"
                ? props.fill
                : name === "Line"
                  ? "var(--chart-line-primary)"
                  : `var(--chart-${(out.length % 12) + 1})`;
          out.push({
            key: props.dataKey,
            name: typeof props.name === "string" ? props.name : undefined,
            color,
            yAxisId: props.yAxisId,
            curve: props.curve,
          });
        }
        return;
      }
      if (props.children) visit(props.children);
    });
  };
  visit(children);
  return out;
}

export interface ChartAnalyticsHostInput {
  analytics?: readonly ChartAnalytic[];
  data?: readonly AnalyticRow[];
  xDataKey: string;
  /** The container's series children (read for keys, names, colours, curves). */
  children?: ReactNode;
  /** Overrides the series read off `children` (a container whose values are not `dataKey` children). */
  series?: readonly AnalyticsSourceSeries[];
  /** The drawn axis carrying the values. Default `"y"`. */
  valueAxis?: "x" | "y";
  /** The x axis is continuous too (scatter): an `x` analytic reduces the x column. */
  xContinuous?: boolean;
  valueFormat?: ChartValueFormat;
  currency?: string;
  /** Keys of `Scatter trend` aliases — the legacy `TrendLine` paints and describes them. */
  legacyTrendIds?: ReadonlySet<string>;
}

export interface ChartAnalyticsHostResult {
  /** `true` when the container has anything to draw or describe. */
  active: boolean;
  /** Computed line/band annotations to append to the container's own. */
  annotations: ChartAnnotation[];
  derived: readonly DerivedSeries[];
  marks: readonly ResolvedAnalyticMark[];
  description: string | undefined;
  /** Wraps the plot with the analytics providers (identity when inactive). */
  provide: (node: ReactNode) => ReactNode;
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/**
 * Resolves a container's `analytics` once and returns the annotation entries,
 * the derived series, the description and a `provide(plot)` wrapper. Call it
 * unconditionally (it is a hook); with no `analytics` it is inert.
 */
export function useChartAnalyticsHost(input: ChartAnalyticsHostInput): ChartAnalyticsHostResult {
  const { analytics, data, xDataKey, children, valueAxis, xContinuous, legacyTrendIds } = input;
  const { t, formatDate } = useLocale();
  // A computed value reads in the value axis' own notation: the container's
  // `valueFormat`, else the first `<YAxis valueFormat|currency|unit>` child.
  const axisFormat = useMemo(() => findValueAxisFormat(children), [children]);
  const baseFormat = useChartValueFormatter(
    input.valueFormat ?? axisFormat?.valueFormat,
    input.currency ?? axisFormat?.currency,
  );
  const unit = axisFormat?.unit;
  const format = useCallback(
    (value: number) => (unit ? `${baseFormat(value)} ${unit}` : baseFormat(value)),
    [baseFormat, unit],
  );
  const [hiddenDerived, setHiddenDerived] = useState<ReadonlySet<string>>(EMPTY_SET);
  const hiddenRef = useRef(hiddenDerived);
  hiddenRef.current = hiddenDerived;
  const [legendVisible, setLegendVisible] = useState(false);
  const [occupiedById, setOccupiedById] = useState<ReadonlyMap<string, OccupiedLabelBox>>(
    () => new Map(),
  );
  const reportOccupied = useCallback((id: string, box: OccupiedLabelBox | null) => {
    setOccupiedById((prev) => {
      const current = prev.get(id);
      if (box === null) {
        if (!current) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      }
      if (
        current &&
        current.y === box.y &&
        current.left === box.left &&
        current.right === box.right
      )
        return prev;
      const next = new Map(prev);
      next.set(id, box);
      return next;
    });
  }, []);
  const occupied = useMemo(() => [...occupiedById.values()], [occupiedById]);
  const reportLegendVisible = useCallback((visible: boolean) => {
    setLegendVisible((prev) => (prev === visible ? prev : visible));
  }, []);

  const has = Boolean(analytics?.length);
  const seriesInput = input.series;
  const series = useMemo(
    () => (!has ? [] : (seriesInput ?? collectAnalyticsSeries(children))),
    [has, seriesInput, children],
  );

  const computed = useMemo(() => {
    if (!has || !data) return null;
    const seriesKeys = series.map((s) => s.key);
    const resolved = resolveAnalytics(data, analytics, {
      seriesKeys,
      xDataKey,
      valueAxis,
      xContinuous,
      format,
      formatX: (v) => (v instanceof Date ? formatDate(v, { dateStyle: "medium" }) : format(v)),
      t,
    });
    const derived = deriveAllSeries(data, analytics, {
      xDataKey,
      seriesKeys,
      seriesNames: Object.fromEntries(series.map((s) => [s.key, s.name ?? s.key])),
      seriesColors: Object.fromEntries(series.map((s) => [s.key, s.color ?? ""])),
      seriesAxes: Object.fromEntries(series.map((s) => [s.key, s.yAxisId])),
      format,
      t,
    });
    const axis = valueAxis ?? "y";
    // A statistic of a field the chart does not draw (`of: "previous"`) has no
    // axis of its own: it widens every value axis.
    const drawn = (keys: AnalyticExtent["keys"]): AnalyticExtent["keys"] =>
      keys === "all" || keys.some((key) => seriesKeys.includes(key)) ? keys : "all";
    const extents: AnalyticExtent[] = resolved.extents.map((e) => ({ ...e, keys: drawn(e.keys) }));
    const horizonX: unknown[] = [];
    for (const d of derived) {
      if (legacyTrendIds?.has(d.id)) continue;
      const e = derivedExtent(d, axis);
      if (e) extents.push(e);
      if (d.horizonX) horizonX.push(...d.horizonX);
    }
    const replacedKeys = new Set(derived.filter((d) => d.replace).map((d) => d.of));
    const describable = derived.filter((d) => !legacyTrendIds?.has(d.id));
    return {
      resolved,
      derived,
      extents,
      horizonX,
      replacedKeys,
      description: describeAnalytics(resolved.marks, describable),
    };
  }, [
    has,
    data,
    analytics,
    series,
    xDataKey,
    valueAxis,
    xContinuous,
    format,
    formatDate,
    t,
    legacyTrendIds,
  ]);

  const syncHiddenKeys = useCallback((keys: ReadonlySet<string>) => {
    const next = new Set<string>();
    for (const key of keys) next.add(key);
    if (!setsEqual(hiddenRef.current, next)) setHiddenDerived(next);
  }, []);

  const curves = useMemo(() => Object.fromEntries(series.map((s) => [s.key, s.curve])), [series]);

  const value = useMemo<ChartAnalyticsContextValue | null>(() => {
    if (!computed) return null;
    return {
      derived: computed.derived,
      marks: computed.resolved.marks,
      extents: computed.extents,
      horizonX: computed.horizonX,
      replacedKeys: computed.replacedKeys,
      hiddenDerived,
      syncHiddenKeys,
      curves,
      xDataKey,
      paintedElsewhere: legacyTrendIds ?? EMPTY_SET,
      legendVisible,
      reportLegendVisible,
      occupied,
      reportOccupied,
    };
  }, [
    computed,
    hiddenDerived,
    syncHiddenKeys,
    curves,
    xDataKey,
    legacyTrendIds,
    legendVisible,
    reportLegendVisible,
    occupied,
    reportOccupied,
  ]);

  const description = computed?.description;
  const provide = useCallback(
    (node: ReactNode): ReactNode =>
      value ? (
        <ChartAnalyticsContext.Provider value={value}>
          <ChartAnalyticsDescriptionContext.Provider value={description}>
            {node}
          </ChartAnalyticsDescriptionContext.Provider>
        </ChartAnalyticsContext.Provider>
      ) : (
        node
      ),
    [value, description],
  );

  return {
    active: value !== null,
    annotations: computed?.resolved.annotations ?? [],
    derived: computed?.derived ?? [],
    marks: computed?.resolved.marks ?? [],
    description,
    provide,
  };
}

/** Legend entries of the derived series, and the relabelled measure a `replace` window stands in for. */
export interface AnalyticsLegendEntry {
  key: string;
  label: string;
  color: string;
  dashed: boolean;
}

/**
 * The legend engine's hook into analytics: `items` with a `replace` window's
 * measure renamed (it keeps its key, so toggling it hides the replacement,
 * and loses its legend `value`) followed by one dashed entry per other
 * derived series, which carry no value either; and the hidden-key
 * set the PLOT should use — the legend's own plus every replaced measure.
 */
export function useAnalyticsLegend<T extends { key: string; label: string; color: string }>(
  items: readonly T[] | undefined,
  legendHidden: ReadonlySet<string>,
): {
  items: (T | (AnalyticsLegendEntry & { kind: "overlay" }))[] | undefined;
  plotHidden: ReadonlySet<string>;
  /**
   * The keys the LEGEND paints hidden: the legend's own plus every derived
   * entry whose source measure is toggled off — a trend of a hidden series
   * is not drawn, so its entry must not read as active.
   */
  displayHidden: ReadonlySet<string>;
  dashedKeys: ReadonlySet<string>;
  /** The dash rhythm of each derived entry that has one. */
  dashes: ReadonlyMap<string, string>;
} {
  const ctx = useContext(ChartAnalyticsContext);
  const sync = ctx?.syncHiddenKeys;
  // The legend lives inside the plot, the derived layer and the tooltip read
  // the host: hand the toggle state up (a no-op unless the membership changed).
  useEffect(() => {
    sync?.(legendHidden);
  }, [sync, legendHidden]);
  return useMemo(() => {
    if (!ctx || ctx.derived.length === 0) {
      return {
        items: items as T[] | undefined,
        plotHidden: legendHidden,
        displayHidden: legendHidden,
        dashedKeys: EMPTY_SET,
        dashes: NO_DASHES,
      };
    }
    const replaced = new Map(ctx.derived.filter((d) => d.replace).map((d) => [d.of, d]));
    const base = (items ?? []).map((item) => {
      const r = replaced.get(item.key);
      // The entry now names the window, so the measure's own legend value
      // (F09) would print a number the plot no longer draws: drop it.
      return r ? { ...item, label: r.name, color: r.color, value: undefined } : item;
    });
    const extra = ctx.derived
      .filter((d) => !d.replace)
      .map((d) => ({
        key: d.key,
        label: d.label,
        color: d.color,
        dashed: d.dashed,
        kind: "overlay" as const,
      }));
    const plotHidden = legendHidden;
    // An overlay follows its source: toggling the measure off takes its trend
    // (window, forecast) off the plot, so the legend dims that entry too.
    const following = ctx.derived.filter((d) => !d.replace && legendHidden.has(d.of));
    const displayHidden =
      following.length === 0
        ? legendHidden
        : new Set([...legendHidden, ...following.map((d) => d.key)]);
    const patterned = ctx.derived.filter((d) => !d.replace && d.dash !== undefined);
    const dashedKeys = new Set(patterned.map((d) => d.key));
    const dashes = new Map(patterned.map((d) => [d.key, d.dash as string]));
    return { items: [...base, ...extra], plotHidden, displayHidden, dashedKeys, dashes };
  }, [ctx, items, legendHidden]);
}

/**
 * The legend engine's second hook into analytics: tells the host whether a
 * legend naming the derived series is on screen. While it is, the derived
 * layer paints no end tags (the legend already names every model); while it
 * is not, each derived path names itself at its last point. Outside an
 * analytics host this is a no-op; unmounting reports `false`.
 */
export function useReportAnalyticsLegend(visible: boolean): void {
  const report = useContext(ChartAnalyticsContext)?.reportLegendVisible;
  useEffect(() => {
    report?.(visible);
    return () => report?.(false);
  }, [report, visible]);
}

/** A stable element list helper: `true` when a child tree already holds an element of `type`. */
export function hasChildOfType(children: ReactNode, displayName: string): boolean {
  let found = false;
  Children.forEach(children, (child) => {
    if (found || !isValidElement(child)) return;
    const type = (child as ReactElement).type as { displayName?: string };
    if (type.displayName === displayName) found = true;
  });
  return found;
}

/**
 * Registers an in-plot label's line box with the enclosing analytics host (a
 * no-op outside one), so a derived series' end tag never prints over it.
 * Pass `null` while the label does not render.
 */
export function useReportOccupiedLabel(id: string, box: OccupiedLabelBox | null): void {
  const report = useContext(ChartAnalyticsContext)?.reportOccupied;
  const y = box?.y;
  const left = box?.left;
  const right = box?.right;
  useEffect(() => {
    if (!report) return;
    report(
      id,
      y === undefined || left === undefined || right === undefined ? null : { y, left, right },
    );
    return () => report(id, null);
  }, [report, id, y, left, right]);
}
