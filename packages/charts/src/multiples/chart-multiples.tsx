"use client";

/**
 * `ChartMultiples` (RM-120) — small multiples: one chart per facet value, in a
 * responsive grid, with shared or range-rounded value scales, panel sort, a
 * repeated muted baseline, synced hover and per-breakpoint panel visibility.
 *
 * The children render function returns any chart container (line / area /
 * bar / pie …); the container reads the panel's facet scope for its domain,
 * ticks, axis visibility and hover — no prop threading. The panels reuse the
 * breakpoint, axis, format, label and annotation engines unchanged.
 */
import {
  forwardRef,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { cn, useLocale } from "@elabs-ai/components-ui";

import type { ChartAnnotation } from "../charts/annotations/annotation-types";
import {
  breakpointForWidth,
  type ChartPlotHeight,
  type Responsive,
  resolveResponsive,
} from "../charts/chart-breakpoint";
import { type ChartFacetScopeValue, useChartConfig } from "../charts/chart-config-context";
import { useChartValueFormatter } from "../charts/chart-formatters";
import type { ChartHoverCategory } from "../charts/chart-hover-link";
import type { AxisDomain } from "../charts/y-axis-scales";
import {
  FACET_GAP,
  FACET_MIN_PANEL_WIDTH,
  facetCell,
  isFacetColumnBottom,
  resolveFacetColumns,
  splitFacetRows,
} from "./facet-layout";
import { FacetPanel } from "./facet-panel";
import { tickTargetForHeight } from "../charts/tick-targets";
import { computeFacetScales, facetValueExtent } from "./facet-scales";
import {
  type FacetPanelStats,
  type FacetSort,
  facetPanelStats,
  sortFacetPanels,
} from "./facet-sort";

/** Row key a `baseline: { key }` panel's values are joined into every panel under. */
export const FACET_BASELINE_KEY = "__facetBaseline";

/** Default panel plot height, in px. */
export const FACET_DEFAULT_PANEL_HEIGHT = 200;

/** Default column count: auto-packed, one column at `narrow`. */
export const FACET_DEFAULT_COLUMNS: Responsive<number | "auto"> = { base: "auto", narrow: 1 };

/** A panel given explicitly (instead of `data` + `by`). */
export interface ChartMultiplesPanelInput<T> {
  key: string;
  /** Visible title. Default: `key`. */
  title?: string;
  data: T[];
  /** Show this panel per breakpoint (`{ base: true, narrow: false }` hides it on phones). */
  showAt?: Responsive<boolean>;
}

/** What the children render function and `panelTitle` receive. */
export interface ChartMultiplesPanel<T> {
  key: string;
  title: string;
  /** The panel's rows (a `baseline: { key }` value is joined in under {@link FACET_BASELINE_KEY}). */
  data: T[];
  /** Start / end / delta / % change / range of the first `dataKeys` column. */
  stats: FacetPanelStats;
  /** 0-based position among the visible, sorted panels. */
  index: number;
  /** The annotations for this panel (`panel` unset or `"all"` → every panel). */
  annotations: ChartAnnotation[];
}

/** The synced-hover state a panel title can show (value-in-title). */
export interface ChartMultiplesHover<T> {
  /** The hovered category (x value) — the same in every panel. */
  category: Exclude<ChartHoverCategory, null>;
  /** This panel's row at that category, if it has one. */
  row: T | undefined;
  /** This panel's first `dataKeys` value at that category, or `null`. */
  value: number | null;
}

export interface ChartMultiplesScales {
  /** The category axis is always shared: labels paint on the bottom panel of each column. */
  x?: "shared";
  /** `"shared"` (default): one domain, labels on the outer column only. */
  y?: "shared" | "independent";
  /** With `y: "independent"`: nice domains cut into the same number of steps, so gridlines align. */
  rangeRounding?: boolean;
  /** Pin either end of every panel's value domain (RM-108 `AxisDomain`). */
  yDomain?: AxisDomain;
}

export type ChartMultiplesBaseline = { key: string } | { series: string };

export interface ChartMultiplesProps<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "title"> {
  /** Long rows, split into panels by `by`. Ignored when `panels` is set. */
  data?: T[];
  /**
   * A column key (one panel per value), or `{ series: true }` — one panel per
   * `dataKeys` entry over the same rows (split bars).
   */
  by?: string | { series: true };
  /** Explicit panels (instead of `data` + `by`). */
  panels?: ChartMultiplesPanelInput<T>[];
  /** Row key of the x value (hover lookup, shared x extent, baseline join). */
  xDataKey: string;
  /** Row keys of the plotted values; the first drives sort, stats and the hovered value. */
  dataKeys: string[];
  /** Panels per row, per breakpoint. Default `{ base: "auto", narrow: 1 }`. */
  columns?: Responsive<number | "auto">;
  /** Minimum panel width `columns: "auto"` packs to. Default 240. */
  minPanelWidth?: number;
  /** Each panel's plot height (px or `{ aspect }`), per breakpoint. Default 200. */
  panelHeight?: Responsive<ChartPlotHeight>;
  scales?: ChartMultiplesScales;
  /** Panel order. Default `"data"` (input order). Numeric keys sort largest first. */
  sort?: FacetSort;
  /** Reverse the sort order. */
  reverse?: boolean;
  /** A series drawn muted behind every panel's own series: a panel `key` (removed from the grid) or a row `series` key. */
  baseline?: ChartMultiplesBaseline;
  /** Per-panel visibility, per breakpoint (a panel's own `showAt` wins). */
  showAt?: (panel: ChartMultiplesPanel<T>) => Responsive<boolean>;
  /**
   * Synced hover: every panel shows the crosshair at the hovered category and
   * `panelTitle` receives the hovered value. Line, Area and Composed panels
   * only; bar and pie panels get the shared layout and domains. Default `true`.
   */
  syncHover?: boolean;
  /** Title slot; `hovered` is set while any panel is hovered (value-in-title). */
  panelTitle?: (panel: ChartMultiplesPanel<T>, hovered?: ChartMultiplesHover<T>) => ReactNode;
  /** Annotations; `panel` names one panel, `"all"`/unset repeats it in every panel. */
  annotations?: Array<ChartAnnotation & { panel?: string }>;
  /** Renders one panel's chart. */
  children: (panel: ChartMultiplesPanel<T>) => ReactNode;
}

function categoryTime(value: unknown): unknown {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" && value !== "" && Number.isNaN(Number(value))) {
    const time = Date.parse(value);
    return Number.isNaN(time) ? value : time;
  }
  return value;
}

function sameCategory(a: unknown, b: unknown): boolean {
  return a === b || categoryTime(a) === categoryTime(b);
}

function timeExtent(
  rows: readonly Record<string, unknown>[],
  xKey: string,
): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    const value = row[xKey];
    if (!(value instanceof Date)) return null;
    const time = value.getTime();
    if (Number.isNaN(time)) continue;
    min = Math.min(min, time);
    max = Math.max(max, time);
  }
  return min <= max ? [min, max] : null;
}

function useElementWidth(): [(node: HTMLDivElement | null) => void, number] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!node) return undefined;
    setWidth(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width];
}

function assignRef<E>(ref: ForwardedRef<E>, value: E | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

function DefaultPanelTitle({ title, value }: { title: string; value: number | null | undefined }) {
  const format = useChartValueFormatter();
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <span className="truncate text-caption font-medium text-foreground">{title}</span>
      {value != null ? (
        <span
          className="shrink-0 text-caption text-muted-foreground tabular-nums"
          data-slot="chart-multiples-panel-value"
        >
          {format(value)}
        </span>
      ) : null}
    </div>
  );
}

function ChartMultiplesInner<T extends Record<string, unknown>>(
  {
    data,
    by,
    panels: panelsProp,
    xDataKey,
    dataKeys,
    columns = FACET_DEFAULT_COLUMNS,
    minPanelWidth = FACET_MIN_PANEL_WIDTH,
    panelHeight = FACET_DEFAULT_PANEL_HEIGHT,
    scales,
    sort = "data",
    reverse = false,
    baseline,
    showAt,
    syncHover = true,
    panelTitle,
    annotations,
    children,
    className,
    style,
    ...props
  }: ChartMultiplesProps<T>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { locale } = useLocale();
  const { breakpoint: forcedBreakpoint } = useChartConfig();
  const [measureRef, width] = useElementWidth();
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      measureRef(node);
      assignRef(ref, node);
    },
    [measureRef, ref],
  );
  const breakpoint = forcedBreakpoint ?? breakpointForWidth(width);

  // 1. Panels in input order (explicit, or split by `by`), baseline joined in.
  const bySeries = typeof by === "object" && by !== null && by.series === true;
  const byColumn = typeof by === "string" ? by : undefined;
  const inputs = useMemo<ChartMultiplesPanelInput<T>[]>(() => {
    if (panelsProp) return panelsProp;
    if (!data) return [];
    if (bySeries) return dataKeys.map((dataKey) => ({ key: dataKey, data }));
    if (!byColumn) return [];
    return splitFacetRows(data, byColumn).map((group) => ({
      key: group.key,
      data: group.rows as T[],
    }));
  }, [panelsProp, data, bySeries, byColumn, dataKeys]);

  const baselinePanelKey = baseline && "key" in baseline ? baseline.key : undefined;
  const baselineKey = baseline
    ? "key" in baseline
      ? FACET_BASELINE_KEY
      : baseline.series
    : undefined;
  const firstKey = dataKeys[0];
  /** The value column a panel's stats, sort, hover value and scale read. */
  const valueKeyOf = useCallback(
    (panelKey: string) => (bySeries && !panelsProp ? panelKey : firstKey),
    [bySeries, panelsProp, firstKey],
  );

  const sortedPanels = useMemo(() => {
    const baselineRows = baselinePanelKey
      ? inputs.find((panel) => panel.key === baselinePanelKey)?.data
      : undefined;
    const joined = inputs
      .filter((panel) => panel.key !== baselinePanelKey)
      .map((panel) => {
        const valueKey = valueKeyOf(panel.key);
        const rows =
          baselineRows && valueKey !== undefined
            ? panel.data.map((row) => {
                const match = baselineRows.find((b) => sameCategory(b[xDataKey], row[xDataKey]));
                return { ...row, [FACET_BASELINE_KEY]: match?.[valueKey] } as T;
              })
            : panel.data;
        return {
          input: panel,
          key: panel.key,
          title: panel.title ?? panel.key,
          data: rows,
          stats: facetPanelStats(rows, valueKey),
        };
      });
    return sortFacetPanels(joined, sort, reverse, locale);
  }, [inputs, baselinePanelKey, valueKeyOf, xDataKey, sort, reverse, locale]);

  // 2. Visibility at this breakpoint.
  const visible = useMemo(() => {
    const out: ChartMultiplesPanel<T>[] = [];
    for (const entry of sortedPanels) {
      const panel: ChartMultiplesPanel<T> = {
        key: entry.key,
        title: entry.title,
        data: entry.data,
        stats: entry.stats,
        index: out.length,
        annotations: (annotations ?? []).filter(
          (a) => a.panel === undefined || a.panel === "all" || a.panel === entry.key,
        ),
      };
      const rule = entry.input.showAt ?? showAt?.(panel) ?? true;
      if (resolveResponsive(rule, breakpoint)) out.push(panel);
    }
    return out;
  }, [sortedPanels, annotations, showAt, breakpoint]);

  // 3. Scales, computed once for the visible panels.
  const scaleKeys = useMemo(
    () => (baselineKey ? [...dataKeys, baselineKey] : dataKeys),
    [dataKeys, baselineKey],
  );
  // a-15: a short panel gets fewer shared ticks, the same rule a lone chart
  // follows (`tickTargetForHeight`) — at `panelHeight={140}` five labels sat
  // 15 px apart with a 15 px line box, so "1,000" and "1,500" overlapped by
  // 31.8 px². An aspect-sized panel keeps the default target.
  const panelTickTarget = useMemo(() => {
    const resolved = resolveResponsive(panelHeight, breakpoint);
    return typeof resolved === "number" ? tickTargetForHeight(resolved) : undefined;
  }, [panelHeight, breakpoint]);
  const yMode = scales?.y ?? "shared";
  const rangeRounding = scales?.rangeRounding;
  const yDomain = scales?.yDomain;
  const panelScales = useMemo(
    () =>
      computeFacetScales(
        visible.map((panel) => {
          const own = valueKeyOf(panel.key);
          const keys = bySeries && !panelsProp && own !== undefined ? [own] : scaleKeys;
          return facetValueExtent(
            panel.data,
            baselineKey && keys !== scaleKeys ? [...keys, baselineKey] : keys,
          );
        }),
        { y: yMode, rangeRounding, tickTarget: panelTickTarget, yDomain },
      ),
    [
      panelTickTarget,
      visible,
      scaleKeys,
      valueKeyOf,
      bySeries,
      panelsProp,
      baselineKey,
      yMode,
      rangeRounding,
      yDomain,
    ],
  );
  const sharedXDomain = useMemo<[Date, Date] | undefined>(() => {
    const extents = visible.map((panel) => timeExtent(panel.data, xDataKey));
    if (extents.length < 2 || extents.some((e) => e === null)) return undefined;
    const known = extents as Array<[number, number]>;
    const lo = Math.min(...known.map((e) => e[0]));
    const hi = Math.max(...known.map((e) => e[1]));
    const differ = known.some((e) => e[0] !== lo || e[1] !== hi);
    return differ ? [new Date(lo), new Date(hi)] : undefined;
  }, [visible, xDataKey]);

  // 4. Synced hover: the last panel to report a category owns it.
  const [hover, setHover] = useState<{ owner: string; category: ChartHoverCategory } | null>(null);
  const reporters = useMemo(() => {
    const map = new Map<string, (category: ChartHoverCategory) => void>();
    for (const panel of visible) {
      map.set(panel.key, (category) =>
        setHover((prev) => {
          if (category !== null) return { owner: panel.key, category };
          return prev?.owner === panel.key ? null : prev;
        }),
      );
    }
    return map;
  }, [visible]);
  const hoverCategory = syncHover ? (hover?.category ?? null) : null;

  const columnCount = resolveFacetColumns(
    resolveResponsive(columns, breakpoint),
    width,
    visible.length,
    minPanelWidth,
    FACET_GAP,
  );
  const sharedY = yMode === "shared";

  return (
    <div
      ref={setRef}
      className={cn("grid w-full gap-4", className)}
      data-chart-breakpoint={breakpoint}
      data-columns={columnCount}
      data-slot="chart-multiples"
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`, ...style }}
      {...props}
    >
      {visible.map((panel, index) => {
        const scale = panelScales[index] ?? {};
        const scope: ChartFacetScopeValue = {
          panelKey: panel.key,
          ...facetCell(index, visible.length, columnCount),
          bottom: isFacetColumnBottom(index, visible.length, columnCount),
          sharedY,
          sharedX: true,
          yDomain: scale.domain,
          yTicks: scale.ticks,
          xDomain: sharedXDomain,
          baselineKey,
          hoverCategory: syncHover ? hoverCategory : undefined,
          onHoverCategory: syncHover ? reporters.get(panel.key) : undefined,
        };
        let hovered: ChartMultiplesHover<T> | undefined;
        if (hoverCategory !== null) {
          const row = panel.data.find((r) => sameCategory(r[xDataKey], hoverCategory));
          const valueKey = valueKeyOf(panel.key);
          const raw = row && valueKey !== undefined ? row[valueKey] : undefined;
          hovered = {
            category: hoverCategory,
            row,
            value: typeof raw === "number" && Number.isFinite(raw) ? raw : null,
          };
        }
        return (
          <FacetPanel
            key={panel.key}
            hostBreakpoint={breakpoint}
            plotHeight={panelHeight}
            scope={scope}
            title={
              panelTitle ? (
                panelTitle(panel, hovered)
              ) : (
                <DefaultPanelTitle title={panel.title} value={hovered?.value} />
              )
            }
          >
            {children(panel)}
          </FacetPanel>
        );
      })}
    </div>
  );
}

/**
 * Small multiples: one chart per facet value in a responsive grid, with
 * shared or range-rounded scales, sort, a muted baseline and synced hover.
 * Panel furniture density follows the HOST grid's tier, not each panel's own
 * width (an explicit host `narrow` density still wins), while every panel still
 * publishes its own `data-chart-breakpoint`.
 *
 * @dataShape many overlapping lines over time — one panel per series instead of a
 *   spaghetti chart, so each trend reads on its own
 * @dataShape one measure across many categories or groups — a grid of panels that
 *   share a scale, read as one picture
 * @avoidWhen fewer than 3 panels, or the comparison IS the overlap — use one chart
 */
export const ChartMultiples = forwardRef(ChartMultiplesInner) as (<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  props: ChartMultiplesProps<T> & { ref?: ForwardedRef<HTMLDivElement> },
) => ReactElement | null) & { displayName?: string };
ChartMultiples.displayName = "ChartMultiples";
