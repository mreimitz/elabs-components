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
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { cn, useLocale } from "@elabs-ai/components-ui";
import type { ChartAnalytic } from "../analytics/types"; // Analytics — RM-138
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "../chart-a11y";
import { resolvePalette, type ChartPalette } from "../chart-context";
import type { ChartInteractionProps } from "../chart-datapoint";
import { ChartSelectionMark, type ChartSelectionProps, resolveMarkPaint } from "../chart-selection";
import { ChartDatapointLayer, ChartDatapointProvider } from "../chart-datapoint-layer";
import { useChartValueFormatter, useChartValueSetFormatterFactory } from "../chart-formatters";
import { isPaletteFill, makeSeriesPattern, seriesPatternId } from "../series-pattern";
import { ChartTooltipBox } from "../tooltip/tooltip-box";
import { useHighDecorationOf } from "../use-high-decoration";
import { ChartTooltipContent } from "../tooltip/tooltip-content";
import { useOnMarkInk } from "../use-on-mark-ink";
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
import {
  DistributionReferenceLines,
  type DistributionReferenceLine,
  resolveDistributionReferenceLines,
  type ResolvedDistributionReferenceLine,
} from "./distribution-reference-line";
import { DistributionValueAxis } from "./distribution-value-axis";
import { KDE_TAPER, silvermanBandwidth } from "./kde";
import { BOX_BODY_OPACITY, DistributionBox } from "./kinds/box";
import { DistributionHistogram } from "./kinds/histogram";
import { DistributionStrip } from "./kinds/strip";
import { DistributionViolin, VIOLIN_BODY_OPACITY } from "./kinds/violin";
import { ChartPlotRoot, type ChartPlotHeight, type Responsive } from "../chart-breakpoint";
import { resolveChartMargin } from "../chart-margin";
import { ChartLoadingPlot } from "../chart-loading-plot";
import type { ChartStatus } from "../chart-phase";
import type { ChartStateGroupProps } from "../props/chart-state";
import type { FrameSizeGroupProps } from "../props/frame-size";
import { DISTRIBUTION_CHART } from "../../definitions/distribution-chart.definition";
import { useResolvedChartProps } from "../use-resolved-chart-props";
// Selection gestures — RM-143/144
import {
  ChartSelectionGestureHitArea,
  ChartSelectionGestureHost,
  ChartSelectionGestureScope,
} from "../selection/chart-gesture-layer";
import type { ChartSelectionGestureProps } from "../selection/types";
import { useContainerSelection } from "../selection/container-selection";
import { DistributionSelectionLayer } from "./distribution-selection";
import type { ChartMessages } from "../props/messages";
import { ChartMessagesScope } from "../chart-messages";
import { resolveAnalytics, widenDomainForAnalytics } from "../analytics/resolve-analytics";

/** Room for the group labels, which sit on the cross axis. */
const HORIZONTAL_MARGIN: DistributionMargin = { top: 10, right: 20, bottom: 28, left: 96 };
const VERTICAL_MARGIN: DistributionMargin = { top: 10, right: 20, bottom: 30, left: 54 };

/** Below this the plot area is not worth drawing into. */
const MIN_PLOT_SIZE = 24;

export interface DistributionChartProps
  extends
    ChartInteractionProps,
    ChartA11yProps,
    // Selection gestures — RM-143/144: a value-axis range; rect / lasso on strips.
    ChartSelectionGestureProps,
    // Selection paint-back (RM-185, F22): a host tells the chart which GROUPS
    // (the one dimension a distribution has — `groupKey`) are selected /
    // associated / excluded; every kind paints the same lane, whole-band outline.
    // `selectionStates`' `category` argument is always a STRING here: the
    // stringified group key (`groupRecords` keys every group by
    // `String(row[groupKey])`), or the `valueKey` name itself for an
    // ungrouped chart. A host comparing against a non-string group value
    // (e.g. a numeric year) must coerce its own side to match — resolving
    // this against the row's raw, un-stringified value is left as a
    // follow-up (RM-185 review, minor). Per-value-RANGE selection intents
    // (as opposed to whole-group ones) still cannot be painted back; F22 is
    // only closed for the per-group lane.
    ChartSelectionProps,
    FrameSizeGroupProps,
    Pick<ChartStateGroupProps, "status"> {
  /**
   * messages group (RM-187): this chart's own words, keyed by the ui
   * catalogue's `charts.*` message keys. A key set here wins over the
   * `LocaleProvider`; every other key reads the catalogue as before.
   */
  messages?: ChartMessages;
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
   * Histogram with `unit` only: the legend that makes the rungs decodable —
   * "one rung = 5 tickets". Rendered as a caption under the plot and folded
   * into the accessible description. Ignored without `unit`.
   */
  unitLabel?: string;
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
  /**
   * Fixed thresholds drawn across the shared value axis (an SLA, a spec
   * limit, a target) — dashed `--chart-foreground`, haloed so it stays
   * legible over a box/violin body. Each labelled line's fact is folded into
   * the chart's own accessible description, so it is never colour-only or
   * visual-only. Default none — omitting it renders byte-identical to before
   * this prop existed.
   */
  referenceLines?: DistributionReferenceLine[];
  /**
   * Computed lines and bands on the value axis (RM-138, ADR 0040 §1): an
   * average, a percentile, `{ spread: { ci: 0.95 } }`, `{ spread: { stddev: 1 } }`
   * … over `valueKey`, drawn like `referenceLines` and restated in the
   * accessible description. Unset: no change.
   */
  analytics?: readonly ChartAnalytic[];
  /**
   * The plot's own height (ADR 0039): px, or `{ aspect }` (width ÷ height),
   * optionally per breakpoint. Unset (default): fills the height its parent
   * gives it, exactly as before this prop existed.
   */
  plotHeight?: Responsive<ChartPlotHeight>;
  /**
   * Chart margins: one number for every side, or per side. Merged over the
   * orientation's own default (`HORIZONTAL_MARGIN`/`VERTICAL_MARGIN`).
   */
  margin?: number | Partial<DistributionMargin>;
  /**
   * Loading vs ready (RM-185). `"loading"` shows a skeleton in the plot box the
   * chart will fill, with one polite status message, until the data is ready.
   * Default: `"ready"`.
   */
  status?: ChartStatus;
  className?: string;
  style?: CSSProperties;
}

// Unwrapped implementation; the public docblock sits on `DistributionChart` below (RM-187).
const DistributionChartUnscoped = forwardRef<HTMLDivElement, DistributionChartProps>(
  function DistributionChart(rawProps, forwardedRef) {
    // RM-185: every default comes from the definition (`DISTRIBUTION_CHART`).
    const {
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
      margin: marginProp,
      maxInteractiveDatapoints,
      onDatapointClick,
      orientation,
      palette,
      plotHeight,
      referenceLines: referenceLinesProp,
      analytics, // Analytics — RM-138
      showMedian,
      showOutliers,
      status,
      style,
      unit,
      unitLabel,
      valueFormat,
      valueKey,
      // Selection gestures — RM-143/144
      selectionGestures,
      onSelectionIntent,
      selectionConfirm,
      selectionField,
      selectionHitRule,
      selectionToolbar,
      // Selection paint-back — RM-185: `resolveMarkPaint` defaults `dimExcluded`
      // to `true` when unset, the same convention `BarChart` uses — no inline
      // default here.
      selectionStates,
      dimExcluded,
    } = useResolvedChartProps(DISTRIBUTION_CHART, rawProps);
    const internalRef = useRef<HTMLDivElement | null>(null);
    // RM-145: the selection session + toolbar; a pass-through with gestures off.
    const containerSelection = useContainerSelection({
      selectionGestures,
      onSelectionIntent,
      selectionConfirm,
      selectionField,
      selectionHitRule,
      selectionToolbar,
    });
    const formatValue = useChartValueFormatter(valueFormat, currency);
    const formatValueSet = useChartValueSetFormatterFactory(valueFormat, currency);
    // Analytics — RM-138: statistics in `referenceLines` and `analytics` line/band
    // entries resolve against the RECORD rows' `valueKey`.
    const { t } = useLocale();
    const referenceLines = useMemo(
      () =>
        resolveDistributionReferenceLines(
          referenceLinesProp,
          analytics,
          data,
          valueKey,
          formatValue,
          t,
        ),
      [referenceLinesProp, analytics, data, valueKey, formatValue, t],
    );

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
     * silhouette's tails are not clipped by the plot edge. A reference line
     * past the data's own extreme (an SLA the data already clears) widens the
     * domain to include it, with breathing room — otherwise the threshold
     * lands flush against the plot edge, cramped against the last tick.
     */
    const baseDomain = useMemo<[number, number]>(() => {
      if (allValues.length === 0) return [0, 1];
      if (sharedBins) {
        return [sharedBins.edges[0] as number, sharedBins.edges.at(-1) as number];
      }
      const [dataLo, dataHi] = extentOf(allValues);
      const referenceValues = referenceLines.flatMap((line) =>
        line.to === undefined ? [line.value] : [line.value, line.to],
      );
      const lo = referenceValues.length > 0 ? Math.min(dataLo, ...referenceValues) : dataLo;
      const hi = referenceValues.length > 0 ? Math.max(dataHi, ...referenceValues) : dataHi;
      if (kind === "violin") {
        let widest = 0;
        for (const group of groups) {
          const h = bandwidth && bandwidth > 0 ? bandwidth : silvermanBandwidth(group.values);
          if (h > widest) widest = h;
        }
        return [lo - KDE_TAPER * widest, hi + KDE_TAPER * widest];
      }
      if (referenceValues.length === 0) return [lo, hi];
      const pad = (hi - lo || 1) * 0.08;
      return [lo - pad, hi + pad];
    }, [allValues, bandwidth, groups, kind, referenceLines, sharedBins]);

    // RM-188: `ifOverflow: "extend"` goes through the shared analytics extents.
    // Every reference value above already sits inside the non-histogram domain,
    // so this only moves a histogram's bin-edge domain, and only when an
    // analytic asks to extend. No analytics: the same array, unchanged.
    const analyticsExtents = useMemo(
      () =>
        analytics?.length
          ? resolveAnalytics(data, analytics, { seriesKeys: [valueKey], format: formatValue, t })
              .extents
          : undefined,
      [analytics, data, valueKey, formatValue, t],
    );
    const domain = useMemo(
      () => widenDomainForAnalytics(baseDomain, analyticsExtents, [valueKey]),
      [baseDomain, analyticsExtents, valueKey],
    );

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
    const caption = kind === "histogram" && unit !== undefined && unit > 0 ? unitLabel : undefined;
    // A labelled reference line is a fact ("SLA: 48h at …"), not only ink — it
    // is folded into the composed description alongside the five-number
    // summary so it reaches assistive tech even though the line itself is
    // `aria-hidden` (`.claude/rules/charts.md` § Marks).
    const referenceLineText = useMemo(() => {
      const labelled = referenceLines.filter((line) => line.label || line.description);
      if (labelled.length === 0) return undefined;
      return labelled
        .map((line) => line.description ?? `${line.label} at ${formatValue(line.value)}`)
        .join("; ");
    }, [formatValue, referenceLines]);
    const description =
      accessibleDescription ??
      ([caption, summary, referenceLineText].filter(Boolean).join(". ") || undefined);

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

    // RM-185: with no `plotHeight`, the chart fills whatever height its parent
    // gives it — exactly as before this prop existed — so the ready plot box
    // is forced only once the caller opts in.
    const plotBox =
      plotHeight === undefined ? undefined : { plotHeight, defaultPlotHeight: plotHeight };

    if (status === "loading") {
      return containerSelection.wrap(
        <ChartLoadingPlot
          className={cn("relative w-full", plotBox ? undefined : "h-full", className)}
          // RM-185 review: a fallback `defaultPlotHeight` here would give the
          // loading box an aspect-ratio height the ready box (below) never
          // has when `plotHeight` is unset, so the two would differ inside a
          // `ChartFrame` or an unsized parent — `fillsFrame` sizes it the
          // same way the ready root is sized instead.
          fillsFrame={plotBox ? undefined : true}
          plotBox={plotBox}
          ref={mergedRef}
          style={style}
        />,
      );
    }

    const body = (
      <ChartPlotRoot
        aria-describedby={a11y["aria-describedby"]}
        aria-label={a11y["aria-label"]}
        className={cn(
          // RM-185: byte-identical to before `plotHeight` existed when it is
          // unset — `plotBox ? undefined : "h-full"` would still compute the
          // same classes, but in a different ORDER, which a DOM snapshot sees.
          plotBox ? "relative flex w-full flex-col" : "relative flex h-full w-full flex-col",
          className,
        )}
        data-slot="distribution-chart"
        plotBox={plotBox}
        ref={mergedRef}
        role={a11y.role}
        style={style}
        tabIndex={a11y.tabIndex}
      >
        <ChartA11yLabel descId={a11y.descId} description={description} />
        <ParentSize className="min-h-0 flex-1" debounceTime={10}>
          {({ width, height }) => (
            <DistributionChartInner
              bandwidth={bandwidth}
              colors={colors}
              containerRef={internalRef}
              domain={domain}
              formatValue={formatValue}
              formatValueSet={formatValueSet}
              groups={groups}
              height={height}
              kind={kind}
              marginProp={marginProp}
              orientation={orientation}
              dimExcluded={dimExcluded}
              referenceLines={referenceLines}
              selectionStates={selectionStates}
              sharedBins={sharedBins}
              showMedian={showMedian}
              showOutliers={showOutliers}
              unit={unit}
              valueKey={valueKey}
              width={width}
            />
          )}
        </ParentSize>
        {caption ? (
          <p
            className="text-chart-label text-caption mt-1 shrink-0 text-center"
            data-slot="distribution-chart-unit-label"
          >
            {caption}
          </p>
        ) : null}
        {/* The keyboard targets: real buttons, OUTSIDE the aria-hidden svg. */}
        <ChartDatapointLayer />
        {/* RM-143/144: range bubbles / thumbs / keyboard rectangle; null when gestures are off. */}
        <ChartSelectionGestureHost />
      </ChartPlotRoot>
    );
    // RM-143/144: a pass-through unless gestures AND a handler are set.
    const scoped = (
      <ChartSelectionGestureScope
        onSelectionIntent={onSelectionIntent}
        selectionConfirm={selectionConfirm}
        selectionField={selectionField}
        selectionGestures={selectionGestures}
        selectionHitRule={selectionHitRule}
        selectionToolbar={selectionToolbar}
      >
        {body}
      </ChartSelectionGestureScope>
    );

    // The provider is mounted only when the caller asked for interaction, so an
    // ordinary chart's DOM is byte-identical to a non-interactive one (#349).
    if (!(onDatapointClick || copyValueOnActivate)) return containerSelection.wrap(scoped);
    return containerSelection.wrap(
      <ChartDatapointProvider
        copyValueOnActivate={copyValueOnActivate}
        datapointLabel={datapointLabel}
        maxInteractiveDatapoints={maxInteractiveDatapoints}
        onDatapointClick={onDatapointClick}
      >
        {scoped}
      </ChartDatapointProvider>,
    );
  },
);

// RM-187: scopes this chart's `messages` overrides (the `messages` group) to
// its subtree — see `chart-messages.tsx`. Renders no DOM of its own.
/**
 * DistributionChart — histogram / box / violin / strip of one numeric variable,
 * optionally by group, on one shared scale.
 *
 * @dataShape the spread of one measure, optionally grouped — a histogram, box plot or strip
 *   plot
 * @avoidWhen a single summary number would do — use a metric card
 */
export const DistributionChart = forwardRef<HTMLDivElement, DistributionChartProps>(
  function DistributionChart({ messages, ...props }, ref) {
    return (
      <ChartMessagesScope messages={messages}>
        <DistributionChartUnscoped {...props} ref={ref} />
      </ChartMessagesScope>
    );
  },
);

DistributionChart.displayName = "DistributionChart";

interface DistributionChartInnerProps extends Pick<
  ChartSelectionProps,
  "dimExcluded" | "selectionStates"
> {
  bandwidth?: number;
  colors: string[];
  containerRef: MutableRefObject<HTMLDivElement | null>;
  domain: [number, number];
  formatValue: (value: number) => string;
  /** #250: one formatter for the value axis' tick set (RM-187). */
  formatValueSet: (values: readonly number[]) => (value: number) => string;
  groups: DistributionGroup[];
  height: number;
  kind: DistributionKind;
  marginProp?: number | Partial<DistributionMargin>;
  orientation: DistributionOrientation;
  referenceLines: ResolvedDistributionReferenceLine[];
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
  dimExcluded,
  domain,
  formatValue,
  formatValueSet,
  groups,
  height,
  kind,
  marginProp,
  orientation,
  referenceLines,
  selectionStates,
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

  // Decoration pattern (ADR 0011, #257): under high decoration each group's
  // FILLED mark (histogram bar, box capsule, violin body) draws its series
  // pattern — pattern index = group index, ink = the group's own colour — so
  // groups stay apart without hue. Strip dots and `unit` rungs are too small /
  // stroked to carry a texture and keep the solid colour.
  const high = useHighDecorationOf(containerRef);
  const patternScope = useId().replace(/:/g, "");
  const patternGroups = useMemo(() => {
    if (!high || kind === "strip") {
      return [];
    }
    return groups
      .map((group) => ({
        color: colors[group.index] ?? colors[0] ?? "var(--chart-1)",
        index: group.index,
      }))
      .filter(({ color }) => isPaletteFill(color));
  }, [colors, groups, high, kind]);
  const patternedGroups = useMemo(
    () => new Set(patternGroups.map(({ index }) => index)),
    [patternGroups],
  );

  // Memoized (unlike a plain call) so a stable `marginProp`/`orientation` keeps
  // the SAME object identity across re-renders — `geometry` below depends on
  // it, and a fresh object every render defeated that memo (RM-185 review: a
  // tooltip-only hover was recomputing 2,000 points' layout on every render).
  const margin = useMemo(
    () =>
      resolveChartMargin(
        marginProp,
        orientation === "horizontal" ? HORIZONTAL_MARGIN : VERTICAL_MARGIN,
      ),
    [marginProp, orientation],
  );
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

  // #243 — the box/violin median tick is cut in whichever on-mark ink reads on
  // the group's own resolved fill, composited at the mark's body opacity.
  const inkFor = useOnMarkInk(containerRef);

  if (plotWidth < MIN_PLOT_SIZE || plotHeight < MIN_PLOT_SIZE) return null;

  // The hovered bar, box, violin or dot, from plot into container px like the anchor.
  const markRect = tooltip?.mark
    ? { ...tooltip.mark, x: tooltip.mark.x + margin.left, y: tooltip.mark.y + margin.top }
    : null;

  return (
    <>
      <svg aria-hidden="true" height={height} role="presentation" width={width}>
        {patternGroups.length > 0 && (
          <defs>
            {patternGroups.map(({ color, index }) =>
              makeSeriesPattern(index, seriesPatternId(index, patternScope), color),
            )}
          </defs>
        )}
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* RM-143/144: a drag may start between dots; null unless gestures are on. */}
          <ChartSelectionGestureHitArea height={geometry.plotHeight} width={geometry.plotWidth} />
          <DistributionValueAxis
            formatValue={formatValue}
            formatValueSet={formatValueSet}
            geometry={geometry}
            groups={groups}
          />
          {/* Analytics — RM-138: a computed band washes UNDER the marks. */}
          <DistributionReferenceLines geometry={geometry} layer="back" lines={referenceLines} />
          {groups.map((group) => {
            const color = colors[group.index] ?? colors[0] ?? "var(--chart-1)";
            const common = {
              color,
              fill: patternedGroups.has(group.index)
                ? `url(#${seriesPatternId(group.index, patternScope)})`
                : undefined,
              formatValue,
              geometry,
              group,
              onHover: handleHover,
              showMedian,
            };
            const groupKeyValue = group.key || group.label;
            let mark: ReactNode;
            switch (kind) {
              case "histogram":
                mark = (
                  <DistributionHistogram
                    {...common}
                    bins={sharedBins?.perGroup.get(group.key) ?? []}
                    countMax={sharedBins?.countMax ?? 0}
                    key={groupKeyValue}
                    unit={unit}
                  />
                );
                break;
              case "box":
                mark = (
                  <DistributionBox
                    {...common}
                    key={groupKeyValue}
                    medianInk={inkFor(color, BOX_BODY_OPACITY).ink}
                    showOutliers={showOutliers}
                  />
                );
                break;
              case "violin":
                mark = (
                  <DistributionViolin
                    {...common}
                    bandwidth={bandwidth}
                    key={groupKeyValue}
                    medianInk={inkFor(color, VIOLIN_BODY_OPACITY).ink}
                  />
                );
                break;
              default:
                mark = (
                  <DistributionStrip
                    {...common}
                    key={groupKeyValue}
                    offsetX={margin.left}
                    offsetY={margin.top}
                    valueKey={valueKey}
                  />
                );
            }
            // Selection paint-back (RM-185, F22): a distribution's one dimension is
            // its GROUP (`groupKey`), so — unlike a per-record gesture — a host
            // resolves the tri-state per group, and every kind's whole per-group
            // visual unit (bar set, box, violin body, strip column) paints the same
            // lane outline/dim, never per record. Unset `selectionStates` resolves
            // no paint anywhere, so the DOM stays byte-identical (`resolveMarkPaint`).
            const paint = resolveMarkPaint(
              { dimExcluded, selectionStates },
              { category: group.label },
            );
            if (paint["data-selection"] === undefined) {
              return mark;
            }
            const bandCenter = geometry.crossPos(group.index);
            const bandStart = bandCenter - geometry.bandInner / 2;
            const laneRect =
              geometry.orientation === "horizontal"
                ? { height: geometry.bandInner, width: geometry.plotWidth, x: 0, y: bandStart }
                : { height: geometry.plotHeight, width: geometry.bandInner, x: bandStart, y: 0 };
            return (
              <ChartSelectionMark key={groupKeyValue} paint={paint} shape={<rect {...laneRect} />}>
                {mark}
              </ChartSelectionMark>
            );
          })}
          <DistributionReferenceLines geometry={geometry} layer="front" lines={referenceLines} />
          {/* RM-143/144: renders null unless selection gestures are enabled. */}
          <DistributionSelectionLayer
            formatValue={formatValue}
            geometry={geometry}
            groups={groups}
            kind={kind}
            valueKey={valueKey}
          />
        </g>
      </svg>
      <ChartTooltipBox
        avoid={markRect}
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
