"use client";

/**
 * distribution-chart.tsx — one container, one numeric scale, four marks
 * (RM-026, issue #195).
 *
 * ## What it is for
 *
 * Latency, ticket resolution time, an A/B result: a numeric variable measured
 * once per RECORD, optionally split by group. Before this container existed the
 * only way to plot such data in `@elabs-ai/components-charts` was to pre-aggregate
 * it into bars — which throws away the shape (skew, bimodality, the tail) that
 * was the whole reason for looking.
 *
 * ## Why one container and not four
 *
 * `histogram`, `box`, `violin` and `strip` are four READINGS of the same
 * numbers, and the `SKILL` decision tree for a grouped continuous distribution
 * walks them in order (`strip` → `box` → `violin`, each step trading record-level
 * detail for legibility as n grows, each needing a written reason). Four
 * containers would have meant four axes, four tooltips and four chances for the
 * scales to disagree — and switching reading would have been a rewrite instead
 * of one prop. So the scale, the axis, the groups, the tooltip and the a11y
 * summary live here, and `kinds/*.tsx` only draw.
 *
 * `"ridge"` is reserved, not shipped: a ridgeline needs overlapping bands with
 * paper occlusion, which the flat band layout here does not model. It is a
 * follow-up rather than a fifth string that renders nothing.
 *
 * ## Which kind to reach for
 *
 * | n per group | reach for | because |
 * | --- | --- | --- |
 * | up to ~150 | `strip` | every record is visible AND individually clickable |
 * | any | `box` | the five numbers, compactly, many groups side by side |
 * | ~50+ | `violin` | the SHAPE — bimodality a box plot hides completely |
 * | one group | `histogram` | bins whose edges can carry business meaning |
 *
 * ## The one place the shared scale bends
 *
 * `kind="violin"` widens the domain by the KDE taper (1.6 bandwidths past the
 * data — see `kde.ts`), because a silhouette cut off at the extreme observation
 * ends in two flat walls and reads as a bar. Every other kind uses the data's
 * own extent, so `strip`, `box` and `histogram` are pixel-for-pixel comparable
 * and a violin is a hair wider at both ends. Stated here rather than discovered:
 * `distribution-chart.test.tsx` asserts both halves.
 *
 * ## What it does NOT do
 *
 * It does not fetch, aggregate server-side, or own a model call — it renders the
 * rows it is given (D5, `docs/DECISIONS.md`). And it does not make a group's
 * n legible from a violin's WIDTH; each violin is scaled to its own band (see
 * `kinds/violin.tsx`).
 */
import { ParentSize } from "@visx/responsive";
import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import { cn } from "@elabs-ai/components-ui";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "../chart-a11y";
import { resolvePalette, type ChartPalette } from "../chart-context";
import type { ChartInteractionProps } from "../chart-datapoint";
import { ChartDatapointLayer, ChartDatapointProvider } from "../chart-datapoint-layer";
import { useChartValueFormatter } from "../chart-formatters";
import { ChartTooltipBox } from "../tooltip/tooltip-box";
import { ChartTooltipContent } from "../tooltip/tooltip-content";
import type { ChartValueFormat } from "../value-format";
import { binValues, extentOf, type DistributionBin } from "./bins";
import {
  makeDistributionGeometry,
  type DistributionMargin,
  type DistributionOrientation,
} from "./distribution-geometry";
import {
  describeDistribution,
  groupRecords,
  type DistributionGroup,
  type DistributionRow,
} from "./distribution-groups";
import type { DistributionKind, DistributionTooltipPayload } from "./distribution-kind";
import { DistributionValueAxis } from "./distribution-value-axis";
import { KDE_TAPER, silvermanBandwidth } from "./kde";
import { DistributionBox } from "./kinds/box";
import { DistributionHistogram } from "./kinds/histogram";
import { DistributionStrip } from "./kinds/strip";
import { DistributionViolin } from "./kinds/violin";

/** Room for the group labels, which sit on the cross axis. */
const HORIZONTAL_MARGIN: DistributionMargin = { top: 10, right: 20, bottom: 28, left: 96 };
const VERTICAL_MARGIN: DistributionMargin = { top: 10, right: 20, bottom: 30, left: 54 };

/** Below this the plot area is not worth drawing into. */
const MIN_PLOT_SIZE = 24;

export interface DistributionChartProps extends ChartInteractionProps, ChartA11yProps {
  /**
   * RECORD-level rows — one per observation, NOT pre-aggregated buckets. The
   * container does the aggregating; handing it counts defeats the point.
   */
  data: DistributionRow[];
  /** The numeric column. Rows whose value is not finite are dropped, and counted. */
  valueKey: string;
  /** The grouping column. Omit for a single, ungrouped distribution. */
  groupKey?: string;
  /** Which mark to draw. See the table in this file's header for how to pick. */
  kind: DistributionKind;
  /**
   * Which screen axis the VALUE runs along. `"horizontal"` (default) puts groups
   * in rows, which is what long group labels want; `"vertical"` puts them in
   * columns.
   */
  orientation?: DistributionOrientation;
  /**
   * Histogram only: a bin COUNT hint (nice, approximate) or the FULL ordered
   * edge list. Edges must be meaningful — a value outside an explicit list is
   * dropped with a dev warning rather than absorbed by an end bucket. See
   * `bins.ts`.
   */
  bins?: number | number[];
  /** Violin only: KDE bandwidth. Unset uses Silverman's rule of thumb. */
  bandwidth?: number;
  /** Draw the median: a dashed flag on a histogram, a paper tick on a box/violin. Default `true`. */
  showMedian?: boolean;
  /** Box only: hollow marks beyond 1.5 × IQR. Default `true`. */
  showOutliers?: boolean;
  /**
   * Histogram only: records per rung. Set it to draw each bin as COUNTABLE
   * rungs (`F14`) instead of a bar — the number is the legend ("one rung = 5
   * tickets"), which is why it is a count and not a boolean.
   */
  unit?: number;
  /**
   * Colour family. With `"sequential"`, a box/violin's shade is its MEDIAN RANK
   * — the darkest group has the highest median — so the ordering is carried by
   * the fill as well as by position.
   */
  palette?: ChartPalette;
  /** Value formatting for ticks, tooltips and the text summary. */
  valueFormat?: ChartValueFormat;
  /** ISO 4217 code when `valueFormat="currency"`. */
  currency?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * DistributionChart — histogram / box / violin / strip of one numeric variable,
 * optionally by group, on one shared scale.
 */
export const DistributionChart = forwardRef<HTMLDivElement, DistributionChartProps>(
  function DistributionChart(
    {
      accessibleDescription,
      accessibleLabel,
      bandwidth,
      bins,
      className,
      copyValueOnActivate,
      currency,
      data,
      datapointLabel,
      groupKey,
      kind,
      maxInteractiveDatapoints,
      onDatapointClick,
      orientation = "horizontal",
      palette,
      showMedian = true,
      showOutliers = true,
      style,
      unit,
      valueFormat,
      valueKey,
    },
    forwardedRef,
  ) {
    const internalRef = useRef<HTMLDivElement | null>(null);
    const formatValue = useChartValueFormatter(valueFormat, currency);

    const { groups, allValues } = useMemo(
      () => groupRecords(data, valueKey, groupKey),
      [data, groupKey, valueKey],
    );

    /**
     * The SHARED bins. Computed once over the pooled values, then re-applied to
     * every group as an explicit edge list — two groups binned independently get
     * different edges, and two histograms with different edges compare nothing.
     */
    const sharedBins = useMemo(() => {
      if (kind !== "histogram" || allValues.length === 0) return undefined;
      const pooled = binValues(allValues, { bins, label: valueKey });
      if (pooled.length === 0) return undefined;
      const edges = [pooled[0]?.x0 as number, ...pooled.map((entry) => entry.x1)];
      const perGroup = new Map<string, DistributionBin[]>();
      for (const group of groups) {
        perGroup.set(group.key, binValues(group.values, { bins: edges, label: group.label }));
      }
      let countMax = 0;
      for (const list of perGroup.values()) {
        for (const entry of list) {
          if (entry.count > countMax) countMax = entry.count;
        }
      }
      return { edges, perGroup, countMax };
    }, [allValues, bins, groups, kind, valueKey]);

    /**
     * The one domain. A histogram's is its bin edges (the axis must end where
     * the last bucket ends); a violin's is widened by the KDE taper so the
     * silhouette's tails are not clipped by the plot edge.
     */
    const domain = useMemo<[number, number]>(() => {
      if (allValues.length === 0) return [0, 1];
      if (sharedBins) {
        return [sharedBins.edges[0] as number, sharedBins.edges.at(-1) as number];
      }
      const [lo, hi] = extentOf(allValues);
      if (kind !== "violin") return [lo, hi];
      let widest = 0;
      for (const group of groups) {
        const h = bandwidth && bandwidth > 0 ? bandwidth : silvermanBandwidth(group.values);
        if (h > widest) widest = h;
      }
      return [lo - KDE_TAPER * widest, hi + KDE_TAPER * widest];
    }, [allValues, bandwidth, groups, kind, sharedBins]);

    /**
     * One colour per group. With `"sequential"` a box/violin is shaded by MEDIAN
     * RANK, so the ramp answers "which group is slowest" rather than "which
     * group was listed first" — the ordered ramp's whole purpose (RM-018).
     */
    const colors = useMemo(() => {
      const ramp = resolvePalette(palette, Math.max(1, groups.length), {
        explicit: palette !== undefined,
      });
      const byIndex = (index: number) => ramp[index % ramp.length] as string;
      if (palette !== "sequential" || (kind !== "box" && kind !== "violin")) {
        return groups.map((group) => byIndex(group.index));
      }
      const ranked = groups
        .filter((group) => group.summary)
        .slice()
        .sort((a, b) => (a.summary?.median ?? 0) - (b.summary?.median ?? 0));
      const rankOf = new Map(ranked.map((group, rank) => [group.key, rank]));
      return groups.map((group) => byIndex(rankOf.get(group.key) ?? group.index));
    }, [groups, kind, palette]);

    const summary = useMemo(() => describeDistribution(groups, formatValue), [formatValue, groups]);
    const description = accessibleDescription ?? (summary || undefined);

    const a11y = useChartA11yContainerProps(accessibleLabel, description);

    const mergedRef = useCallback(
      (node: HTMLDivElement | null) => {
        internalRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [forwardedRef],
    );

    const body = (
      <div
        aria-describedby={a11y["aria-describedby"]}
        aria-label={a11y["aria-label"]}
        className={cn("relative h-full w-full", className)}
        data-slot="distribution-chart"
        ref={mergedRef}
        role={a11y.role}
        style={style}
        tabIndex={a11y.tabIndex}
      >
        <ChartA11yLabel descId={a11y.descId} description={description} />
        <ParentSize debounceTime={10}>
          {({ width, height }) => (
            <DistributionChartInner
              bandwidth={bandwidth}
              colors={colors}
              containerRef={internalRef}
              domain={domain}
              formatValue={formatValue}
              groups={groups}
              height={height}
              kind={kind}
              orientation={orientation}
              sharedBins={sharedBins}
              showMedian={showMedian}
              showOutliers={showOutliers}
              unit={unit}
              valueKey={valueKey}
              width={width}
            />
          )}
        </ParentSize>
        {/* The keyboard targets: real buttons, OUTSIDE the aria-hidden svg. */}
        <ChartDatapointLayer />
      </div>
    );

    // The provider is mounted only when the caller asked for interaction, so an
    // ordinary chart's DOM is byte-identical to a non-interactive one (#349).
    if (!(onDatapointClick || copyValueOnActivate)) return body;
    return (
      <ChartDatapointProvider
        copyValueOnActivate={copyValueOnActivate}
        datapointLabel={datapointLabel}
        maxInteractiveDatapoints={maxInteractiveDatapoints}
        onDatapointClick={onDatapointClick}
      >
        {body}
      </ChartDatapointProvider>
    );
  },
);

DistributionChart.displayName = "DistributionChart";

interface DistributionChartInnerProps {
  bandwidth?: number;
  colors: string[];
  containerRef: MutableRefObject<HTMLDivElement | null>;
  domain: [number, number];
  formatValue: (value: number) => string;
  groups: DistributionGroup[];
  height: number;
  kind: DistributionKind;
  orientation: DistributionOrientation;
  sharedBins?: { edges: number[]; perGroup: Map<string, DistributionBin[]>; countMax: number };
  showMedian: boolean;
  showOutliers: boolean;
  unit?: number;
  valueKey: string;
  width: number;
}

function DistributionChartInner({
  bandwidth,
  colors,
  containerRef,
  domain,
  formatValue,
  groups,
  height,
  kind,
  orientation,
  sharedBins,
  showMedian,
  showOutliers,
  unit,
  valueKey,
  width,
}: DistributionChartInnerProps) {
  const [tooltip, setTooltip] = useState<DistributionTooltipPayload | null>(null);

  // Stable, so a memoized kind is not re-rendered by the tooltip's own state.
  const handleHover = useCallback((payload: DistributionTooltipPayload | null) => {
    setTooltip(payload);
  }, []);

  const margin = orientation === "horizontal" ? HORIZONTAL_MARGIN : VERTICAL_MARGIN;
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const geometry = useMemo(
    () =>
      makeDistributionGeometry({
        orientation,
        plotWidth,
        plotHeight,
        domain,
        bandCount: Math.max(1, groups.length),
        margin,
      }),
    [domain, groups.length, margin, orientation, plotHeight, plotWidth],
  );

  if (plotWidth < MIN_PLOT_SIZE || plotHeight < MIN_PLOT_SIZE) return null;

  return (
    <>
      <svg aria-hidden="true" height={height} role="presentation" width={width}>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <DistributionValueAxis formatValue={formatValue} geometry={geometry} groups={groups} />
          {groups.map((group) => {
            const color = colors[group.index] ?? colors[0] ?? "var(--chart-1)";
            const common = {
              color,
              formatValue,
              geometry,
              group,
              onHover: handleHover,
              showMedian,
            };
            switch (kind) {
              case "histogram":
                return (
                  <DistributionHistogram
                    {...common}
                    bins={sharedBins?.perGroup.get(group.key) ?? []}
                    countMax={sharedBins?.countMax ?? 0}
                    key={group.key || group.label}
                    unit={unit}
                  />
                );
              case "box":
                return (
                  <DistributionBox
                    {...common}
                    key={group.key || group.label}
                    showOutliers={showOutliers}
                  />
                );
              case "violin":
                return (
                  <DistributionViolin
                    {...common}
                    bandwidth={bandwidth}
                    key={group.key || group.label}
                  />
                );
              default:
                return (
                  <DistributionStrip
                    {...common}
                    key={group.key || group.label}
                    offsetX={margin.left}
                    offsetY={margin.top}
                    valueKey={valueKey}
                  />
                );
            }
          })}
        </g>
      </svg>
      <ChartTooltipBox
        containerHeight={height}
        containerRef={containerRef}
        containerWidth={width}
        visible={tooltip !== null}
        x={(tooltip?.x ?? 0) + margin.left}
        y={(tooltip?.y ?? 0) + margin.top}
      >
        <ChartTooltipContent rows={tooltip?.rows ?? []} title={tooltip?.title} />
      </ChartTooltipBox>
    </>
  );
}
