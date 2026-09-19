"use client";

import { useId, useMemo, useRef, type ReactNode } from "react";
import { type ChartDensity, useChartConfig } from "./chart-config-context";
import { cn, useLocale } from "@elabs-ai/components-ui";
import { useChartValueSetFormatter } from "./chart-formatters";
import { makeSeriesPattern, seriesDashArray, seriesPatternId } from "./series-pattern";
import { useHighDecorationOf } from "./use-high-decoration";
import type { ChartValueFormat } from "./value-format";

export interface LegendItem {
  /** Display label */
  label: string;
  /** Current value */
  value: number;
  /** Maximum value (for progress bar calculation) */
  maxValue?: number;
  /** Item color */
  color: string;
  /**
   * Series index for pattern/dash differentiation under high decoration.
   * When set, the legend swatch renders the decoration pattern swatch instead of a solid dot.
   */
  seriesIndex?: number;
  /**
   * Stable identity for `hiddenKeys`/`onToggleKey` (RM-118) — a container's
   * own `ChartLegendEntry.key`. Falls back to `label` when unset.
   */
  key?: string;
}

export interface ChartLegendProps {
  /** Legend items to display */
  items: LegendItem[];
  /** Currently hovered index (for highlight effect) */
  hoveredIndex?: number | null;
  /** Callback when an item is hovered */
  onHover?: (index: number | null) => void;
  /**
   * Drill-down on a legend entry (#349). When set, each item renders as a real
   * `<button>` — keyboard operable and named by the item's label — instead of a
   * `<div>`. Unset, the legend is unchanged (a non-interactive `<div>` list).
   *
   * NOTE this lives on `ChartLegend`, not on the chart containers: the legend is
   * a separately-placed composition primitive, so a callback on the container
   * would be a prop the container cannot honour.
   */
  onItemClick?: (
    item: LegendItem,
    index: number,
    event: React.MouseEvent | React.KeyboardEvent,
  ) => void;
  /**
   * Series toggle (RM-118, `legend={{ interactive: "toggle" }}`). Set together
   * with `onToggleKey`: every item renders as a real `<button aria-pressed>`
   * — native keyboard support, no extra wiring — and `hiddenKeys` marks which
   * ones read `aria-pressed="false"` and paint dimmed with a struck-through
   * label (WCAG 1.4.1: hidden is never colour-only). Independent of
   * `onItemClick` (drill-down); a container sets one or the other.
   */
  hiddenKeys?: ReadonlySet<string>;
  /** Toggles one item's hidden state. Keyed by `item.key ?? item.label`. */
  onToggleKey?: (key: string, item: LegendItem, index: number) => void;
  /**
   * Density tiers that hide the whole legend (RM-072 default: `xs`/`sm`).
   * The container legend engine (`useContainerLegend`, RM-118) passes
   * `["xs"]` — `sm` renders `stack`-laid-out instead of hiding — so this
   * stays `["xs", "sm"]` for every OTHER (direct) caller, unchanged.
   */
  hideAtDensity?: readonly ChartDensity[];
  /** Show progress bars. Default: false */
  showProgress?: boolean;
  /** Show color marker dot. Default: true */
  showMarker?: boolean;
  /** Show numeric value column. Default: true */
  showValue?: boolean;
  /** Show percentage value. Default: true when showProgress is true */
  showPercentage?: boolean;
  /** Format function for displaying values. Overrides `valueFormat` entirely when set. */
  formatValue?: (value: number) => string;
  /**
   * How to format `value`/`maxValue` (RM-109) — a preset or the object form
   * (`{ decimals, abbreviate, sign, prefix, suffix, … }`, `value-format.ts`).
   * Resolved as a SET across every item (#250, `useChartValueSetFormatter`)
   * so the legend never mixes "1K" beside "400". Default: locale-aware plain
   * grouping (`intFmt`), unchanged from before this prop existed.
   */
  valueFormat?: ChartValueFormat;
  /** ISO 4217 code for `valueFormat: "currency"`. Falls back to `ChartConfigProvider`, then `"USD"`. */
  currency?: string;
  /** Title shown above the legend */
  title?: string;
  /**
   * Item flow direction (RM-118, sitting 3). `"stack"` (default — every
   * caller before this prop existed) is byte-identical to before: one item
   * per line. `"row"` wraps items left-to-right (`flex-wrap`), matching the
   * layout `AutoChart`'s old `AutoLegend` used, AND drops the `w-full` an
   * interactive (`onItemClick`/toggle) item otherwise gets — `w-full` inside
   * a row would force every item onto its own line regardless of this prop.
   * `useContainerLegend` (the container legend engine) passes its own
   * resolved `layout` ("row" at `base`/`medium`/`wide`, "stack" at `narrow`
   * or density `sm`) through; a direct caller may set its own or leave it
   * unset for the original stacked behaviour.
   */
  layout?: "row" | "stack" | "split";
  /**
   * Accessible name for the legend region (RM-118, sitting 3). Unset
   * (default — every caller before this prop existed) renders no role/name,
   * byte-identical to before. `useContainerLegend` (the container legend
   * engine) always passes the locale-aware `"charts.legend.label"` default
   * ("Chart legend") — the same name `AutoChart`'s old `AutoLegend` gave its
   * `<ul aria-label>` before the engine replaced it. A direct caller may set
   * its own or leave it unset.
   */
  "aria-label"?: string;
  /** Additional class name for the container */
  className?: string;
  /** Class name for the title */
  titleClassName?: string;
  /** Class name for each legend item */
  itemClassName?: string;
  /** Class name for the label */
  labelClassName?: string;
  /** Class name for the value */
  valueClassName?: string;
  /** Custom render function for legend items */
  renderItem?: (props: {
    item: LegendItem;
    index: number;
    isHovered: boolean;
    isFaded: boolean;
    percentage: number;
  }) => ReactNode;
}

/** Inline SVG pattern swatch for decorated legend markers. */
function LegendPatternSwatch({
  seriesIndex,
  color,
  size = 10,
}: {
  seriesIndex: number;
  color: string;
  size?: number;
}) {
  const id = seriesPatternId(seriesIndex, useId().replace(/:/g, ""));
  const dash = seriesDashArray(seriesIndex);
  return (
    <svg aria-hidden="true" width={size} height={size} style={{ flexShrink: 0 }} overflow="visible">
      <defs>{makeSeriesPattern(seriesIndex, id, color)}</defs>
      <rect width={size} height={size} fill={`url(#${id})`} />
      {dash && (
        <line
          x1={0}
          y1={size / 2}
          x2={size}
          y2={size / 2}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray={dash}
        />
      )}
    </svg>
  );
}

// Progress bar item using base-ui
interface ProgressItemProps {
  item: LegendItem;
  showMarker: boolean;
  showValue: boolean;
  showPercentage: boolean;
  formatValue: (value: number) => string;
  /** Locale-aware percentage formatter (0–100 scale in, e.g. "42%" out). */
  formatPercentage: (value: number) => string;
  labelClassName: string;
  valueClassName: string;
  high: boolean;
}

function ProgressItem({
  item,
  showMarker,
  showValue,
  showPercentage,
  formatValue,
  formatPercentage,
  labelClassName,
  valueClassName,
  high,
  faded,
}: ProgressItemProps & { faded?: boolean }) {
  const percentage = item.maxValue ? (item.value / item.maxValue) * 100 : 0;

  // Plain tokenized bar (dropped @base-ui Progress — it can't take a per-series indicator
  // color). item.color is dynamic series data → inline style (a token var from the caller).
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={item.maxValue}
      aria-valuenow={item.value}
      aria-label={item.label}
      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1"
    >
      {/* Color marker — decorative; see the matching note in `SimpleItem`. */}
      {showMarker &&
        (high && item.seriesIndex !== undefined ? (
          <LegendPatternSwatch seriesIndex={item.seriesIndex} color={item.color} />
        ) : (
          <div
            className={cn("h-2.5 w-2.5 shrink-0 rounded-full", faded && "opacity-40")}
            style={{ backgroundColor: item.color }}
          />
        ))}

      {/* Label — hover-faded swaps to the muted-foreground TOKEN, same reasoning as
          `SimpleItem` (a raw row-level `opacity-40` on this text fails AA contrast). */}
      <span
        className={cn(
          "text-legend-foreground",
          faded && "text-legend-muted-foreground",
          labelClassName,
        )}
      >
        {item.label}
      </span>

      {showValue ? (
        <span className={cn("text-legend-muted-foreground", valueClassName)}>
          {formatValue(item.value)}
        </span>
      ) : null}

      {/* Progress track and indicator */}
      <div className="col-span-full h-1.5 overflow-hidden rounded-full bg-legend-track">
        <div
          className="h-full rounded-full transition-[width] duration-slow motion-reduce:transition-none"
          style={{ width: `${percentage}%`, backgroundColor: item.color }}
        />
      </div>

      {/* Percentage */}
      {showPercentage && (
        <span className="col-start-3 text-legend-muted-foreground text-meta tabular-nums">
          {formatPercentage(percentage)}
        </span>
      )}
    </div>
  );
}

// Simple item without progress bar
interface SimpleItemProps {
  item: LegendItem;
  showMarker: boolean;
  showValue: boolean;
  formatValue: (value: number) => string;
  labelClassName: string;
  valueClassName: string;
  high: boolean;
}

function SimpleItem({
  item,
  showMarker,
  showValue,
  formatValue,
  labelClassName,
  valueClassName,
  high,
  hidden,
  faded,
}: SimpleItemProps & { hidden?: boolean; faded?: boolean }) {
  // Note: item.color must remain inline style as it's dynamic data
  return (
    <div className="flex items-center gap-3">
      {/* Color marker — decoration pattern swatch when high decoration + seriesIndex present.
          Decorative (no text), so a plain opacity dim for both the toggled-off and the
          hover-faded state is fine here — the label below carries the WCAG-safe channel. */}
      {showMarker &&
        (high && item.seriesIndex !== undefined ? (
          <LegendPatternSwatch seriesIndex={item.seriesIndex} color={item.color} />
        ) : (
          <div
            className={cn("h-2.5 w-2.5 shrink-0 rounded-full", (hidden || faded) && "opacity-40")}
            style={{ backgroundColor: item.color }}
          />
        ))}

      {/* Label — a toggled-off series (RM-118) also strikes through: hidden is never
          colour/opacity alone (WCAG 1.4.1). A hover-faded (not hidden) row swaps to the
          same muted-foreground TOKEN rather than a raw `opacity-40` on this span: that
          token is already AA-contrast-safe on the legend background, where dimming the
          real ink via opacity is not (an item's other row still passing axe at ~2.3:1
          contrast is what this fixes — see chart-legend.test.tsx). */}
      <span
        className={cn(
          "flex-1 text-legend-foreground",
          (hidden || faded) && "text-legend-muted-foreground",
          hidden && "line-through",
          labelClassName,
        )}
      >
        {item.label}
      </span>

      {showValue ? (
        <span className={cn("text-legend-muted-foreground", valueClassName)}>
          {formatValue(item.value)}
        </span>
      ) : null}
    </div>
  );
}

// split layout — RM-121
/** One row of a `layout="split"` legend: the items of one value axis. */
export interface ChartLegendSplitGroup {
  /** Stable id (the axis id). */
  id: string;
  /** The side label naming the row ("Left scale"). */
  label: ReactNode;
  /** `item.key ?? item.label` of every item in this row. */
  keys: readonly string[];
  /** `"end"` aligns the row with a right-hand axis when rows sit side by side. */
  align?: "start" | "end";
}

export interface ChartLegendProps {
  /**
   * `layout="split"` (RM-121): one row per value axis, each led by its side
   * label. Items not named by any group are omitted. Unset, `"split"`
   * renders as `"row"`.
   */
  splitGroups?: readonly ChartLegendSplitGroup[];
  /** Stack the split rows vertically (the narrow tier). Default `false`: side by side, wrapping. */
  splitStacked?: boolean;
}

/** `layout="split"` (RM-121): one nested row-layout `ChartLegend` per axis group. */
function ChartLegendSplit({
  groups,
  stacked,
  items,
  hoveredIndex,
  onHover,
  onItemClick,
  className,
  "aria-label": ariaLabel,
  ...rest
}: Omit<ChartLegendProps, "splitGroups" | "splitStacked" | "layout"> & {
  groups: readonly ChartLegendSplitGroup[];
  stacked: boolean;
}) {
  const baseId = useId();
  return (
    <div
      className={cn(
        "legend-container flex gap-x-6 gap-y-2",
        stacked ? "flex-col" : "flex-row flex-wrap justify-between",
        className,
      )}
      data-slot="chart-legend-split"
      data-stacked={stacked ? "" : undefined}
      {...(ariaLabel ? { role: "group", "aria-label": ariaLabel } : {})}
    >
      {groups.map((group) => {
        const members = items
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => group.keys.includes(item.key ?? item.label));
        if (members.length === 0) return null;
        const localHovered = members.findIndex(({ index }) => index === hoveredIndex);
        const labelId = `${baseId}-${group.id}`;
        return (
          <div
            aria-labelledby={labelId}
            className={cn(
              "flex min-w-0 flex-row flex-wrap items-center gap-x-2 gap-y-1",
              !stacked && group.align === "end" && "justify-end",
            )}
            data-axis={group.id}
            data-slot="chart-legend-split-row"
            key={group.id}
            role="group"
          >
            <span
              className="text-meta font-medium text-chart-label"
              data-slot="chart-legend-side-label"
              id={labelId}
            >
              {group.label}
            </span>
            <ChartLegend
              {...rest}
              hideAtDensity={[]}
              hoveredIndex={localHovered === -1 ? null : localHovered}
              items={members.map(({ item }) => item)}
              layout="row"
              onHover={(local) => onHover?.(local == null ? null : (members[local]?.index ?? null))}
              onItemClick={
                onItemClick
                  ? (item, local, event) => onItemClick(item, members[local]?.index ?? local, event)
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}

export function ChartLegend({
  items,
  hoveredIndex = null,
  onHover,
  onItemClick,
  hiddenKeys,
  onToggleKey,
  showProgress = false,
  showMarker = true,
  showValue = true,
  showPercentage,
  formatValue,
  valueFormat,
  currency,
  title,
  layout = "stack",
  "aria-label": ariaLabel,
  className = "",
  titleClassName = "text-sm font-semibold",
  itemClassName = "",
  labelClassName = "text-sm font-medium",
  valueClassName = "text-sm tabular-nums",
  renderItem,
  hideAtDensity = ["xs", "sm"],
  splitGroups,
  splitStacked = false,
}: ChartLegendProps) {
  // Default showPercentage to true when showProgress is true
  const displayPercentage = showPercentage ?? showProgress;

  // Locale-aware defaults, bound to the active `LocaleProvider` locale so a
  // legend under `<LocaleProvider locale="de-DE">` reads "1.234" / "42 %",
  // not whatever the host machine happens to be set to. `valueFormat`
  // (RM-109, preset or object spec) resolves as a SET across every item's
  // `value` (#250) so the legend never mixes "1K" beside "400"; a
  // caller-supplied `formatValue` still wins outright.
  //
  // An unset `valueFormat` explicitly resolves to `"number"`, NOT
  // `useChartValueSetFormatter`'s own `"compact"` default: this prop replaced
  // a plain `intFmt` call (grouped digits, never abbreviated), and the legend
  // is a small, fixed set of category totals, not a scale that benefits from
  // compaction the way an axis does. Pass `valueFormat="compact"` explicitly
  // to opt in.
  const { locale } = useLocale();
  const setFormatValue = useChartValueSetFormatter(
    items.map((item) => item.value),
    valueFormat ?? "number",
    currency,
  );
  const resolvedFormatValue = formatValue ?? setFormatValue;
  const formatPercentage = useMemo(() => {
    const fmt = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
    return (value: number) => fmt.format(value / 100);
  }, [locale]);

  // Detect high decoration on the legend container
  const containerRef = useRef<HTMLDivElement>(null);
  const high = useHighDecorationOf(containerRef);
  const { density } = useChartConfig();

  // RM-072: `xs`/`sm` tiles have no room for a legend, by default. A
  // container legend (`useContainerLegend`) narrows this to `["xs"]`.
  if (hideAtDensity.includes(density)) {
    return null;
  }

  // split layout — RM-121
  if (layout === "split" && splitGroups && splitGroups.length > 0) {
    return (
      <ChartLegendSplit
        aria-label={ariaLabel}
        className={className}
        currency={currency}
        formatValue={formatValue}
        groups={splitGroups}
        hiddenKeys={hiddenKeys}
        hoveredIndex={hoveredIndex}
        itemClassName={itemClassName}
        items={items}
        labelClassName={labelClassName}
        onHover={onHover}
        onItemClick={onItemClick}
        onToggleKey={onToggleKey}
        renderItem={renderItem}
        showMarker={showMarker}
        showPercentage={showPercentage}
        showProgress={showProgress}
        showValue={showValue}
        stacked={splitStacked}
        valueClassName={valueClassName}
        valueFormat={valueFormat}
      />
    );
  }
  // split layout — RM-121: `"split"` with no groups flows as a row.
  const flow = layout === "split" ? "row" : layout;

  return (
    <div
      className={cn(
        "legend-container flex",
        // Byte-identical to the pre-existing "flex flex-col gap-2" string for
        // every caller that never passes `layout` (default `"stack"`) — see
        // `ChartLegendProps.layout`'s doc. `row` swaps in a wrapping flex row.
        flow === "row" ? "flex-row flex-wrap gap-x-4 gap-y-2" : "flex-col gap-2",
        className,
      )}
      ref={containerRef}
      {...(ariaLabel ? { role: "group", "aria-label": ariaLabel } : {})}
    >
      {title && <h3 className={cn("mb-1 text-legend-foreground", titleClassName)}>{title}</h3>}
      {items.map((item, i) => {
        const percentage = item.maxValue ? (item.value / item.maxValue) * 100 : 0;
        const isHovered = hoveredIndex === i;
        const isFaded = hoveredIndex !== null && hoveredIndex !== i;
        const itemKey = item.key ?? item.label;
        const isToggleable = Boolean(onToggleKey);
        const isHidden = isToggleable && (hiddenKeys?.has(itemKey) ?? false);

        // A real <button> when the legend is interactive (drill-down or
        // toggle), a plain <div> otherwise — never a div-with-onClick (see
        // accessibility.md, "Real elements"). The button inherits the same
        // box, so the legend looks identical either way. Toggle wins when
        // both are set — a container names one or the other in practice.
        const Item = (onItemClick || isToggleable ? "button" : "div") as "button";
        const interactiveProps: Partial<React.ComponentPropsWithoutRef<"button">> = isToggleable
          ? {
              "aria-pressed": !isHidden,
              onClick: (event) => {
                onToggleKey?.(itemKey, item, i);
                onItemClick?.(item, i, event);
              },
              type: "button",
            }
          : onItemClick
            ? {
                onClick: (event) => onItemClick(item, i, event),
                type: "button",
              }
            : {};

        // Allow custom rendering
        if (renderItem) {
          return (
            <Item
              className={cn((onItemClick || isToggleable) && "text-start focus-ring")}
              data-hovered={isHovered ? "" : undefined}
              key={`legend-${item.label}-${item.value}`}
              onBlur={() => onHover?.(null)}
              onFocus={() => onHover?.(i)}
              onMouseEnter={() => onHover?.(i)}
              onMouseLeave={() => onHover?.(null)}
              {...interactiveProps}
            >
              {renderItem({ item, index: i, isHovered, isFaded, percentage })}
            </Item>
          );
        }

        return (
          <Item
            className={cn(
              "cursor-pointer rounded-lg px-2 py-1.5 transition-[background-color,opacity] duration-fast ease-entrance motion-reduce:transition-none",
              (onItemClick || isToggleable) &&
                (flow === "row" ? "text-start focus-ring" : "w-full text-start focus-ring"),
              isHovered && "bg-legend-muted",
              // NOT a row-level `opacity-40` (that dims the label text below AA contrast —
              // see `SimpleItem`/`ProgressItem`, which each apply their own WCAG-safe
              // treatment for `isFaded` instead).
              itemClassName,
            )}
            data-hovered={isHovered ? "" : undefined}
            key={`legend-${item.label}-${item.value}`}
            onBlur={() => onHover?.(null)}
            onFocus={() => onHover?.(i)}
            onMouseEnter={() => onHover?.(i)}
            onMouseLeave={() => onHover?.(null)}
            {...interactiveProps}
          >
            {showProgress && item.maxValue ? (
              <ProgressItem
                faded={isFaded}
                formatPercentage={formatPercentage}
                formatValue={resolvedFormatValue}
                high={high}
                item={item}
                labelClassName={labelClassName}
                showMarker={showMarker}
                showPercentage={displayPercentage}
                showValue={showValue}
                valueClassName={valueClassName}
              />
            ) : (
              <SimpleItem
                faded={isFaded}
                formatValue={resolvedFormatValue}
                high={high}
                hidden={isHidden}
                item={item}
                labelClassName={labelClassName}
                showMarker={showMarker}
                showValue={showValue}
                valueClassName={valueClassName}
              />
            )}
          </Item>
        );
      })}
    </div>
  );
}

ChartLegend.displayName = "ChartLegend";

export default ChartLegend;
