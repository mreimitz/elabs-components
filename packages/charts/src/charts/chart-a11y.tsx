"use client";

/**
 * chart-a11y — shared accessible-label utilities for @elabs-ai/components-charts.
 *
 * Issue #145. All chart SVG bodies use aria-hidden="true" because the raw SVG
 * paths carry no semantic meaning for AT users. This module provides:
 *
 * 1. `ChartA11yLabel` — a visually-hidden label + optional description element.
 *    Place it as the FIRST child of a chart container `<div>` so AT reads it
 *    before (or in place of) the hidden SVG.
 *
 * 2. `chartA11yProps` — helper that returns the correct `role`, `aria-label`,
 *    and `aria-describedby` props for a chart container div given an accessible
 *    label and optional description id.
 *
 * Usage in a chart container:
 * ```tsx
 * const descId = useId();
 * <div role="figure" aria-label={accessibleLabel} aria-describedby={accessibleDescription ? descId : undefined} ...>
 *   <ChartA11yLabel descId={descId} description={accessibleDescription} />
 *   {children}
 * </div>
 * ```
 *
 * Design decisions:
 * - `role="figure"` (not `role="img"`) because a figure is a self-contained
 *   unit of content with optional caption, and `<figcaption>` semantics map
 *   naturally to the description. A pure `role="img"` would require AT to treat
 *   the whole thing as a single image, but figures allow sub-navigation.
 * - The visually-hidden description uses `id` + `aria-describedby` so it is
 *   supplemental — screen readers announce it after the label, not instead.
 * - The container is `tabIndex={0}` (keyboard-reachable) so keyboard users can
 *   focus the chart region and hear its description without needing to tab
 *   through the internal SVG (which has no keyboard affordances anyway).
 */

import { useLocale } from "@elabs-ai/components-ui";
import {
  Children,
  createContext,
  isValidElement,
  type ReactNode,
  use,
  useId,
  useMemo,
} from "react";
import { makeValueSetFmt } from "./chart-formatters";
import { pickNotableIndices } from "./labels/use-chart-labels";
import type { ChartValueFormat } from "./value-format";

export interface ChartA11yProps {
  /**
   * Accessible name for the chart region. AT announces this when the container
   * receives focus or is read in flow. Example: "Monthly revenue bar chart"
   */
  accessibleLabel?: string;
  /**
   * Supplemental description (series names, value ranges, last values, etc.).
   * Rendered as a visually-hidden `<span>` associated via `aria-describedby`.
   * Example: "Series: Revenue, Expenses. Range: 0–25,000."
   */
  accessibleDescription?: string;
}

/** Visually-hidden description element. Renders nothing when `description` is absent. */
export function ChartA11yLabel({
  descId,
  description,
}: {
  descId: string;
  description: string | undefined;
}) {
  if (!description) return null;
  return (
    <span className="sr-only" id={descId}>
      {description}
    </span>
  );
}

/**
 * Returns the `role`, `aria-label`, `aria-describedby`, and `tabIndex` props
 * to spread onto a chart container `<div>`.
 *
 * When neither label nor description is provided the chart container carries no
 * additional ARIA burden (the SVG is already aria-hidden; axe passes).
 */
export function useChartA11yContainerProps(
  accessibleLabel: string | undefined,
  accessibleDescription: string | undefined,
): {
  role: string | undefined;
  "aria-label": string | undefined;
  "aria-describedby": string | undefined;
  tabIndex: number | undefined;
  descId: string;
} {
  const descId = useId();
  const hasLabel = Boolean(accessibleLabel);
  const hasDesc = Boolean(accessibleDescription);

  return {
    role: hasLabel ? "figure" : undefined,
    "aria-label": accessibleLabel,
    "aria-describedby": hasDesc ? descId : undefined,
    tabIndex: hasLabel ? 0 : undefined,
    descId,
  };
}

// ── Auto summary (RM-110) ────────────────────────────────────────────────────

/** Chart families the auto summary describes. */
export type AutoSummaryKind = "line" | "area" | "bar" | "scatter" | "pie";

/** One series the summary names: its data field and display name. */
export interface DescribeSeriesItem {
  dataKey: string;
  name: string;
}

/** A notable point (the same pass the value labels use): a series and a row index. */
export interface DescribeSeriesNotable {
  dataKey: string;
  index: number;
}

/** The sentence pieces — override any of them to localise the summary. */
export interface DescribeSeriesPhrases {
  kind: Record<AutoSummaryKind, string>;
  series: (count: number) => string;
  over: (from: string, to: string) => string;
  points: (count: number) => string;
  slices: (count: number) => string;
  peak: (name: string, value: string, x: string) => string;
  /** Scatter: the highest point (x is a position, not a period). */
  highestPoint: (name: string, value: string, x: string) => string;
  largestSlice: (name: string, value: string, share: string) => string;
}

export const DEFAULT_DESCRIBE_SERIES_PHRASES: DescribeSeriesPhrases = {
  kind: {
    line: "Line chart",
    area: "Area chart",
    bar: "Bar chart",
    scatter: "Scatter chart",
    pie: "Pie chart",
  },
  series: (count) => `${count} series`,
  over: (from, to) => (from === to ? `in ${from}` : `over ${from}–${to}`),
  points: (count) => (count === 1 ? "1 point" : `${count} points`),
  slices: (count) => (count === 1 ? "1 slice" : `${count} slices`),
  peak: (name, value, x) => (x ? `${name} peaks at ${value} in ${x}` : `${name} peaks at ${value}`),
  highestPoint: (name, value, x) =>
    x ? `highest ${name}: ${value} at ${x}` : `highest ${name}: ${value}`,
  largestSlice: (name, value, share) => `largest: ${name} at ${value} (${share})`,
};

export interface DescribeSeriesOptions {
  kind: AutoSummaryKind;
  /** Row field holding the x value / category / slice name. */
  xKey?: string;
  /** Value formatter (one notation across the set). Default: locale-free `String`. */
  formatValue?: (value: number) => string;
  /** x formatter. Default: {@link formatSummaryX} with no locale. */
  formatX?: (x: unknown) => string;
  /** Share formatter for pie slices (0–1). Default: whole percent. */
  formatShare?: (share: number) => string;
  phrases?: Partial<DescribeSeriesPhrases>;
}

function seriesValues(data: readonly Record<string, unknown>[], dataKey: string): number[] {
  return data.map((row) => {
    const v = row[dataKey];
    return typeof v === "number" ? v : Number.NaN;
  });
}

/**
 * x formatter for summaries: a Date on 1 January of every row reads as its
 * year, on the 1st of a month as "Jan 2024", otherwise as a short date.
 */
export function formatSummaryX(
  x: unknown,
  locale: string | undefined,
  allX: readonly unknown[] = [],
): string {
  if (x instanceof Date) {
    const dates = allX.filter((v): v is Date => v instanceof Date);
    const yearly = dates.every((d) => d.getMonth() === 0 && d.getDate() === 1);
    const monthly = dates.every((d) => d.getDate() === 1);
    const options: Intl.DateTimeFormatOptions = yearly
      ? { year: "numeric" }
      : monthly
        ? { month: "short", year: "numeric" }
        : { month: "short", day: "numeric", year: "numeric" };
    return new Intl.DateTimeFormat(locale, options).format(x);
  }
  if (typeof x === "number") return new Intl.NumberFormat(locale).format(x);
  return x == null ? "" : String(x);
}

/**
 * The auto summary (RM-110): "Line chart, 4 series over 2017–2025; E-bikes
 * peaks at +214 % in 2023". `notable` is the value labels' notable-points
 * pass; when absent each series' peak is found the same way
 * (`pickNotableIndices`, `"peaks"`), and the highest one is named.
 */
export function describeSeries(
  data: readonly Record<string, unknown>[],
  series: readonly DescribeSeriesItem[],
  notable: readonly DescribeSeriesNotable[] | undefined,
  options: DescribeSeriesOptions,
): string {
  const phrases = { ...DEFAULT_DESCRIBE_SERIES_PHRASES, ...options.phrases };
  const kind = phrases.kind[options.kind];
  const allX = options.xKey ? data.map((row) => row[options.xKey as string]) : [];
  const fmtX = options.formatX ?? ((x: unknown) => formatSummaryX(x, undefined, allX));
  const fmtValue = options.formatValue ?? ((v: number) => String(v));
  const xAt = (index: number) =>
    options.xKey ? fmtX((data[index] as Record<string, unknown>)[options.xKey]) : "";

  if (options.kind === "pie") {
    const s = series[0];
    if (!s || data.length === 0) return `${kind}, ${phrases.slices(data.length)}`;
    const values = seriesValues(data, s.dataKey);
    const total = values.reduce((sum, v) => (Number.isFinite(v) && v > 0 ? sum + v : sum), 0);
    const [top] = pickNotableIndices(values, { placement: "peaks", count: 1, minGap: 1 });
    if (top === undefined) return `${kind}, ${phrases.slices(data.length)}`;
    const share = total > 0 ? (values[top] as number) / total : 0;
    const fmtShare =
      options.formatShare ??
      ((v: number) => new Intl.NumberFormat(undefined, { style: "percent" }).format(v));
    return `${kind}, ${phrases.slices(data.length)}; ${phrases.largestSlice(
      xAt(top),
      fmtValue(values[top] as number),
      fmtShare(share),
    )}`;
  }

  const parts = [phrases.series(series.length)];
  const finiteX = allX.filter((x) => x != null && x !== "");
  if (options.kind === "scatter") {
    const count = series.reduce(
      (sum, s) => sum + seriesValues(data, s.dataKey).filter(Number.isFinite).length,
      0,
    );
    parts.push(phrases.points(count));
  }
  let head = `${kind}, ${parts.join(", ")}`;
  if (options.kind !== "scatter" && finiteX.length > 0) {
    head += ` ${phrases.over(fmtX(finiteX[0]), fmtX(finiteX[finiteX.length - 1]))}`;
  }

  const candidates =
    notable && notable.length > 0
      ? notable
      : series.flatMap((s) =>
          pickNotableIndices(seriesValues(data, s.dataKey), {
            placement: "peaks",
            count: 1,
            minGap: 1,
          }).map((index) => ({ dataKey: s.dataKey, index })),
        );
  let best: { item: DescribeSeriesItem; index: number; value: number } | null = null;
  for (const c of candidates) {
    const item = series.find((s) => s.dataKey === c.dataKey);
    const value = (data[c.index] as Record<string, unknown> | undefined)?.[c.dataKey];
    if (!item || typeof value !== "number" || !Number.isFinite(value)) continue;
    if (!best || value > best.value) best = { item, index: c.index, value };
  }
  if (!best) return head;
  const phrase = options.kind === "scatter" ? phrases.highestPoint : phrases.peak;
  return `${head}; ${phrase(best.item.name, fmtValue(best.value), xAt(best.index))}`;
}

const SUMMARISED_SERIES = new Set(["Line", "Area", "Bar", "Scatter"]);

interface SummarisedSeriesProps {
  dataKey?: unknown;
  name?: unknown;
  valueLabels?: { format?: ChartValueFormat };
  children?: ReactNode;
}

function collectSummarySeries(children: ReactNode): {
  series: DescribeSeriesItem[];
  format: ChartValueFormat | undefined;
} {
  const series: DescribeSeriesItem[] = [];
  let format: ChartValueFormat | undefined;
  const visit = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      const type = child.type as { displayName?: string; name?: string };
      const typeName = typeof child.type === "string" ? "" : (type.displayName ?? type.name ?? "");
      const props = child.props as SummarisedSeriesProps;
      if (SUMMARISED_SERIES.has(typeName) && typeof props.dataKey === "string") {
        series.push({
          dataKey: props.dataKey,
          name: typeof props.name === "string" ? props.name : props.dataKey,
        });
        format ??= props.valueLabels?.format;
        return;
      }
      if (props?.children) visit(props.children);
    });
  };
  visit(children);
  return { series, format };
}

export interface ChartAutoSummaryInput {
  accessibleLabel: string | undefined;
  accessibleDescription: string | undefined;
  data: readonly Record<string, unknown>[] | readonly object[];
  /** The chart's children (series read from `Line`/`Area`/`Bar`/`Scatter`). Unused for `pie`. */
  children?: ReactNode;
  /** Row field of the x value / category. Pie: `"label"`. */
  xDataKey?: string;
}

/**
 * The enclosing `ChartFrame`'s `altText` (RM-117). Provided by the frame around
 * its chart body; read only by {@link useChartAutoSummary}. Not exported from
 * the package — the frame is its one provider.
 */
export const ChartFrameAltTextContext = createContext<string | undefined>(undefined);

/**
 * The chart's description: the caller's `accessibleDescription`, else — on a
 * labelled chart (`role="figure"`) — the enclosing frame's `altText`, else the
 * auto summary from {@link describeSeries}. Author text always wins over the
 * generated summary. An unlabelled chart gets nothing, so its DOM is unchanged.
 */
export function useChartAutoSummary(
  kind: AutoSummaryKind,
  input: ChartAutoSummaryInput,
): string | undefined {
  const { locale } = useLocale();
  const { accessibleLabel, accessibleDescription, data, children, xDataKey } = input;
  const frameAltText = use(ChartFrameAltTextContext);
  const authored = accessibleDescription || (accessibleLabel ? frameAltText : undefined);
  const wanted = Boolean(accessibleLabel) && !authored;
  const summary = useMemo(() => {
    if (!wanted) return undefined;
    const rows = data as readonly Record<string, unknown>[];
    const { series, format } =
      kind === "pie"
        ? { series: [{ dataKey: "value", name: "value" }], format: undefined }
        : collectSummarySeries(children);
    if (kind !== "pie" && series.length === 0) return undefined;
    const allValues = series.flatMap((s) => seriesValues(rows, s.dataKey)).filter(Number.isFinite);
    const xKey = kind === "pie" ? "label" : xDataKey;
    const allX = xKey ? rows.map((row) => row[xKey]) : [];
    return describeSeries(rows, series, undefined, {
      kind,
      xKey,
      formatValue: makeValueSetFmt(locale, allValues, format),
      formatX: (x) => formatSummaryX(x, locale, allX),
      formatShare: (v) => new Intl.NumberFormat(locale, { style: "percent" }).format(v),
    });
  }, [wanted, data, kind, children, xDataKey, locale]);
  return authored || summary;
}
