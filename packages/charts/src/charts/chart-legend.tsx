"use client";

import { useId, useRef, type ReactNode } from "react";
import { cn } from "@elabs-ai/components-ui";
import { intFmt } from "./chart-formatters";
import { makeSeriesPattern, seriesDashArray, seriesPatternId } from "./series-pattern";
import { useHighDecorationOf } from "./use-high-decoration";

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
  /** Show progress bars. Default: false */
  showProgress?: boolean;
  /** Show color marker dot. Default: true */
  showMarker?: boolean;
  /** Show numeric value column. Default: true */
  showValue?: boolean;
  /** Show percentage value. Default: true when showProgress is true */
  showPercentage?: boolean;
  /** Format function for displaying values. Default: toLocaleString() */
  formatValue?: (value: number) => string;
  /** Title shown above the legend */
  title?: string;
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
  labelClassName,
  valueClassName,
  high,
}: ProgressItemProps) {
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
      {/* Color marker */}
      {showMarker &&
        (high && item.seriesIndex !== undefined ? (
          <LegendPatternSwatch seriesIndex={item.seriesIndex} color={item.color} />
        ) : (
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
        ))}

      {/* Label */}
      <span className={cn("text-legend-foreground", labelClassName)}>{item.label}</span>

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
          {percentage.toFixed(0)}%
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
}: SimpleItemProps) {
  // Note: item.color must remain inline style as it's dynamic data
  return (
    <div className="flex items-center gap-3">
      {/* Color marker — decoration pattern swatch when high decoration + seriesIndex present */}
      {showMarker &&
        (high && item.seriesIndex !== undefined ? (
          <LegendPatternSwatch seriesIndex={item.seriesIndex} color={item.color} />
        ) : (
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
        ))}

      {/* Label */}
      <span className={cn("flex-1 text-legend-foreground", labelClassName)}>{item.label}</span>

      {showValue ? (
        <span className={cn("text-legend-muted-foreground", valueClassName)}>
          {formatValue(item.value)}
        </span>
      ) : null}
    </div>
  );
}

export function ChartLegend({
  items,
  hoveredIndex = null,
  onHover,
  onItemClick,
  showProgress = false,
  showMarker = true,
  showValue = true,
  showPercentage,
  formatValue = intFmt,
  title,
  className = "",
  titleClassName = "text-sm font-semibold",
  itemClassName = "",
  labelClassName = "text-sm font-medium",
  valueClassName = "text-sm tabular-nums",
  renderItem,
}: ChartLegendProps) {
  // Default showPercentage to true when showProgress is true
  const displayPercentage = showPercentage ?? showProgress;

  // Detect high decoration on the legend container
  const containerRef = useRef<HTMLDivElement>(null);
  const high = useHighDecorationOf(containerRef);

  return (
    <div className={cn("legend-container flex flex-col gap-2", className)} ref={containerRef}>
      {title && <h3 className={cn("mb-1 text-legend-foreground", titleClassName)}>{title}</h3>}
      {items.map((item, i) => {
        const percentage = item.maxValue ? (item.value / item.maxValue) * 100 : 0;
        const isHovered = hoveredIndex === i;
        const isFaded = hoveredIndex !== null && hoveredIndex !== i;

        // A real <button> when the legend is interactive, a plain <div>
        // otherwise — never a div-with-onClick (see accessibility.md,
        // "Real elements"). The button inherits the same box, so the legend
        // looks identical either way.
        const Item = (onItemClick ? "button" : "div") as "button";
        const interactiveProps: Partial<React.ComponentPropsWithoutRef<"button">> = onItemClick
          ? {
              onClick: (event) => onItemClick(item, i, event),
              type: "button",
            }
          : {};

        // Allow custom rendering
        if (renderItem) {
          return (
            <Item
              className={cn(onItemClick && "text-start focus-ring")}
              data-hovered={isHovered ? "" : undefined}
              key={`legend-${item.label}-${item.value}`}
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
              onItemClick && "w-full text-start focus-ring",
              isHovered && "bg-legend-muted",
              isFaded && "opacity-40",
              itemClassName,
            )}
            data-hovered={isHovered ? "" : undefined}
            key={`legend-${item.label}-${item.value}`}
            onMouseEnter={() => onHover?.(i)}
            onMouseLeave={() => onHover?.(null)}
            {...interactiveProps}
          >
            {showProgress && item.maxValue ? (
              <ProgressItem
                formatValue={formatValue}
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
                formatValue={formatValue}
                high={high}
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
