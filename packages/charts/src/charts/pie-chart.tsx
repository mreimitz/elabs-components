"use client";

import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { arc as arcGenerator } from "@visx/shape";
import { pie as d3Pie } from "d3-shape";
import type { Transition } from "motion/react";
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  memo,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@elabs-ai/components-ui";
import { ChartA11yLabel, type ChartA11yProps, useChartA11yContainerProps } from "./chart-a11y";
import type { ChartLegendEntry } from "./chart-context";
// Legend engine — RM-118
import { type ContainerLegendProp, useContainerLegend } from "./legend/use-container-legend";
import { useSharedLegendHoveredKey } from "./legend/shared-legend-hover";
// Labels — RM-110
import { useChartAutoSummary } from "./chart-a11y";
import {
  UnpaintedLabels,
  UnpaintedLabelsProvider,
  useUnpaintedLabelsStore,
} from "./labels/unpainted-labels";
import type { ChartDatapointClickHandler, ChartDatapointLabel } from "./chart-datapoint";
import {
  ChartDatapointLayer,
  type ChartDatapointTarget,
  ChartDatapointProvider,
  useChartDatapointsEnabled,
  useRegisterDatapointTargets,
} from "./chart-datapoint-layer";
import {
  defaultPieColors,
  pieCssVars,
  pieDatapointTarget,
  type PieArcData,
  type PieContextValue,
  type PieData,
  PieProvider,
} from "./pie-context";
import { PieSlice, type PieSliceProps } from "./pie-slice";
import { groupSmallSlices, type PieGroupSmallOptions } from "./pie-grouping";
import { PieLabels, type PieLabelField, type PieLabelPlacement } from "./pie-labels";
import { useChartValueFormatter, useChartValueSetFormatter } from "./chart-formatters";
import { isPaletteFill, makeSeriesPattern, seriesPatternId } from "./series-pattern";
import { useHighDecorationOf } from "./use-high-decoration";
import { type ChartSelectionProps, ChartSelectionProvider } from "./chart-selection";
import {
  ChartPlotRoot,
  type ChartPlotHeight,
  type Responsive,
  type ResponsiveByBreakpoint,
  resolveResponsive,
  useChartBreakpoint,
} from "./chart-breakpoint";

/**
 * `PieChart`'s `labels` prop (RM-114) — opt-in slice labels. Unset renders
 * nothing extra (byte-identical to before this prop existed).
 */
export interface PieChartLabelsConfig {
  /**
   * `"inside"` | `"outside"` | `"none"`, per breakpoint. Default
   * `{ base: "outside", narrow: "none" }` — at `narrow` the legend/key
   * carries the labels instead (ADR 0039's narrow density already hides the
   * legend by default; pass an explicit `legend`/`ChartLegend` to keep one).
   */
  placement?: Responsive<PieLabelPlacement>;
  /** Which facts each label states, in `label → value → percent` order. */
  show: PieLabelField[];
  /**
   * Paint the label in a contrast-safe mix of the slice's own color (via
   * `seriesLabelInk`, ≥4.5:1 on `--chart-background` in every shipped theme)
   * instead of the neutral ink. Default `false`.
   */
  matchColor?: boolean;
  /** Hide an `"inside"` label under this wedge angle (radians). Default `0.2` (~11.5°). */
  minAngle?: number;
}

const DEFAULT_PIE_LABELS_PLACEMENT: ResponsiveByBreakpoint<PieLabelPlacement> = {
  base: "outside",
  narrow: "none",
};

/** Extra room (px) an `"outside"` label placement reserves beyond `outerRadius` for its leader + text. */
const PIE_OUTSIDE_LABEL_GUTTER = 70;

/** Default hover offset in pixels */
export const DEFAULT_HOVER_OFFSET = 10;

// ── radiusKey reference-ring labels (#RM-030, #246) ─────────────────────────
//
// The rings themselves ride the area-honest sqrt(v / max) scale, which
// compresses as the value grows — so the labels must NOT be spaced by the
// rings' own (compressible) radii. Instead every label sits on a single
// vertical leader column outside `outerRadius`, spaced by a fixed minimum
// that no combination of reference values can collapse; a dotted leader
// re-associates each label with its own ring. This reuses the idiom
// `ring.tsx`'s `RingTickRing` already established for `RingChart`'s
// "labels=outside" case.
const REFERENCE_RING_LEADER_RESERVE = 18;
const REFERENCE_RING_LABEL_GAP = 4;
const REFERENCE_RING_LABEL_SPACING = 16;

/** One `referenceRings` value laid out on the leader column. */
interface PieReferenceRingLabel {
  value: number;
  /** The ring's own radius (sqrt(v / max) scale) — where its dashed circle and leader start. */
  ringRadius: number;
  /** Where the leader ends and the label begins, in the fixed-spacing gutter. */
  leaderEndRadius: number;
  /** Radial distance of the label's baseline — always `> outerRadius`. */
  labelRadius: number;
}

/**
 * Lay out `referenceRings`' labels on a fixed-spacing leader column outside
 * `outerRadius`, ordered by each ring's own (sqrt-scaled) radius so leaders
 * never cross. Returns `[]` when there is nothing to draw — the caller's
 * render guard (`radiusKey && referenceRings?.length && radiusKeyMax > 0`)
 * stays the single source of truth for "no-op".
 */
function layoutPieReferenceRingLabels(
  values: number[],
  radiusKeyMax: number,
  innerRadius: number,
  outerRadius: number,
): PieReferenceRingLabel[] {
  if (radiusKeyMax <= 0) {
    return [];
  }
  const rings = values
    .map((value) => {
      const ratio = Math.sqrt(Math.max(value, 0) / radiusKeyMax);
      return { value, ringRadius: innerRadius + (outerRadius - innerRadius) * ratio };
    })
    .sort((a, b) => a.ringRadius - b.ringRadius);

  return rings.map((ring, i) => {
    const leaderEndRadius =
      outerRadius + REFERENCE_RING_LEADER_RESERVE + i * REFERENCE_RING_LABEL_SPACING;
    return {
      ...ring,
      leaderEndRadius,
      labelRadius: leaderEndRadius + REFERENCE_RING_LABEL_GAP,
    };
  });
}

/**
 * The gutter `referenceRings` reserves beyond the ordinary hover-offset
 * padding, so its leader column and labels never clip against the SVG's own
 * bounds. `0` — and therefore byte-identical sizing — whenever
 * `referenceRings` is unset (today's behavior, #246).
 */
function pieReferenceRingGutter(radiusKey: string | undefined, referenceRingCount: number): number {
  if (!radiusKey || referenceRingCount === 0) {
    return 0;
  }
  return (
    REFERENCE_RING_LEADER_RESERVE +
    REFERENCE_RING_LABEL_GAP +
    Math.max(0, referenceRingCount - 1) * REFERENCE_RING_LABEL_SPACING +
    10
  );
}

/** Stable empty array so a non-interactive PieChart never re-registers targets. */
const EMPTY_PIE_TARGETS: ChartDatapointTarget[] = [];

export interface PieChartProps extends ChartSelectionProps {
  /** Data array - each item represents a slice */
  data: PieData[];
  /** Chart size in pixels. If not provided, uses parent container size */
  size?: number;
  /**
   * The plot's own height (ADR 0039): px, or `{ aspect }` (width ÷ height),
   * optionally per breakpoint.
   */
  plotHeight?: Responsive<ChartPlotHeight>;
  /**
   * Inner radius for donut charts, in px — or, below `1`, as a fraction of the outer radius
   * (`0.6` keeps a responsive donut a donut at every size). Default: 0 (solid pie)
   */
  innerRadius?: number;
  /**
   * Where the square plot sits in a container wider than it is tall: `"start"` (default, as
   * before) or `"center"` — centred, and outside labels may run past the square into the
   * free room either side instead of being clipped at it.
   */
  align?: "start" | "center";
  /** Padding angle between slices in radians. Default: 0 */
  padAngle?: number;
  /** Corner radius for rounded slice edges. Default: 0 */
  cornerRadius?: number;
  /** Start angle in radians. Default: -PI/2 (top) */
  startAngle?: number;
  /** End angle in radians. Default: 3*PI/2 (full circle from top) */
  endAngle?: number;
  /** Additional class name for the container */
  className?: string;
  /** Controlled hover state - index of hovered slice */
  hoveredIndex?: number | null;
  /** Callback when hover state changes */
  onHoverChange?: (index: number | null) => void;
  /**
   * Hover offset in pixels for slice hover effects.
   * This also determines the padding around the chart to prevent clipping.
   * Default: 10
   */
  hoverOffset?: number;
  /** Child components (PieSlice, PieCenter, patterns, gradients, etc.) */
  children: ReactNode;
  /**
   * Drill-down (#349). Fires when a slice is activated by pointer OR keyboard.
   * Setting it mounts a keyboard-operable target layer OUTSIDE the aria-hidden
   * SVG — one tab stop, arrow keys to traverse. Unset changes nothing.
   */
  onDatapointClick?: ChartDatapointClickHandler;
  /**
   * Put the datapoint's exact value on the clipboard when it is activated
   * — the recovery path for a compact axis label. Default `false`; a chart
   * with no interaction props still renders byte-identical DOM. A
   * consumer-supplied `onDatapointClick` always wins.
   */
  copyValueOnActivate?: boolean;
  /** Override the accessible name of each keyboard drill-down target (#349). */
  datapointLabel?: ChartDatapointLabel;
  /** Dev-warning threshold on the number of keyboard targets. Default 500 (#349). */
  maxInteractiveDatapoints?: number;
  /** Accessible name for the chart region (announces to AT on focus). */
  accessibleLabel?: ChartA11yProps["accessibleLabel"];
  /** Supplemental description read by AT (e.g. slice names + value range). */
  accessibleDescription?: ChartA11yProps["accessibleDescription"];
  /** Framer Motion transition for slice enter animation */
  enterTransition?: Transition;
  /** Scales slice stagger delays (1 = default). */
  enterStaggerScale?: number;
  /**
   * High-frequency geometry updates (e.g. studio NumberField scrub).
   * Uses plain SVG paths instead of Motion `d` / spring hover morphing.
   */
  geometryScrubbing?: boolean;
  /**
   * Second measure driving each slice's OUTER radius — angle × radius double
   * encoding (lieflat G13 "Big Slice", #RM-030). Reads `data[i][radiusKey]`
   * as a number; `outerRadius = innerRadius + (R - innerRadius) *
   * sqrt(v / max)` (area-honest — equal AREA differences read as equal
   * magnitude differences, not equal radius differences). A slice whose
   * value is missing/non-numeric — or every slice, when `radiusKey` is
   * unset — renders at the chart's full outer radius, today's behavior.
   */
  radiusKey?: string;
  /**
   * Dashed reference rings (in `radiusKey`'s units) with small value labels
   * — e.g. `[15, 30, 45]` for a "minutes/day" second measure. No-op when
   * `radiusKey` is unset.
   */
  referenceRings?: number[];
  /**
   * Paper-seam stroke (px) drawn between slices — the lieflat "3px paper
   * seam" cut-paper look. Default: `0` (no seam — today's behavior).
   */
  seams?: number;
  /**
   * Slice labels (RM-114, Datawrapper parity) — inside/outside placement,
   * `label`/`value`/`percent` facts, leaders on the outside ring. Unset
   * renders nothing extra (today's behavior).
   */
  labels?: PieChartLabelsConfig;
  /**
   * Container legend (RM-118): one swatch per slice, mounted outside the
   * plot via `useContainerLegend`. Unset renders nothing (R1) — today's
   * behavior. Pie has no competing on-chart key the way `colorBy` (Bar) or
   * RM-115's colour/shape key (Scatter) do, so R4's "one key per chart"
   * never applies here.
   *
   * Hover-only (R3): hovering or focusing a legend item reuses Pie's own
   * existing single-slice hover state — the SAME one a pointer hovering a
   * slice already writes into (`hoveredIndex`/`onHoverChange` above) — so a
   * legend hover and a pointer hover dim every other slice identically. An
   * `interactive: "toggle"` request downgrades to `"hover"`: Pie has no
   * hide-a-slice wiring yet (a hidden slice would silently change every
   * other slice's percentage, which needs its own design pass — tracked as
   * a follow-up, not built here).
   *
   * `{ values: true }` prints each slice's value (the folded "Other" slice's
   * sum when `groupSmall` is on).
   */
  legend?: ContainerLegendProp;
  /**
   * Fold the smallest slices into one trailing "Other" slice (RM-114,
   * `pie-grouping.ts`). **Setting this hands slice rendering to `PieChart`
   * itself** — any `PieSlice` elements in `children` are ignored (their
   * indices would no longer match the folded result); keep `PieCenter` and
   * defs/gradient children, they are unaffected. Unset: today's behavior,
   * `children` renders verbatim.
   */
  groupSmall?: PieGroupSmallOptions;
  /**
   * Wedge order. `"desc"` — `startAngle` gets the LARGEST slice, then
   * clockwise by descending size (d3-shape's own pie default). `"none"`
   * (the default here) keeps `data`'s own order — pre-RM-114 behavior,
   * kept as the default so an existing chart's wedge ANGLES never move
   * under it (see the docblock on `effectiveSort` in `PieChartBase` for
   * why the RM's stated `"desc"` default was not adopted). Slice INDEX
   * identity never changes either way — a `<PieSlice index={i}>` always
   * targets `data[i]`; only the angular position can move.
   */
  sort?: "desc" | "none";
  /**
   * The "election donut" preset (RM-114): `startAngle: -π/2, endAngle: π/2`
   * — a dome across the top half, seated in data order by default (`sort`
   * unset here behaves exactly as elsewhere: `"none"`). The centre slot (a
   * `PieCenter` child) is positioned BELOW the arc instead of in the
   * chart's geometric middle. Overrides any `startAngle`/`endAngle` props.
   * Default `false`.
   */
  half?: boolean;
}

interface PieChartInnerProps {
  width: number;
  height: number;
  data: PieData[];
  innerRadius: number;
  padAngle: number;
  cornerRadius: number;
  startAngle: number;
  endAngle: number;
  hoverOffset: number;
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  hoveredIndexProp?: number | null;
  onHoverChange?: (index: number | null) => void;
  enterTransition?: Transition;
  enterStaggerScale: number;
  geometryScrubbing: boolean;
  radiusKey?: string;
  referenceRings?: number[];
  seams: number;
  labels?: PieChartLabelsConfig;
  sort: "desc" | "none";
  half: boolean;
  align?: "start" | "center";
}

function generatePieArcPath(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  cornerRadius: number,
  padAngle: number,
): string {
  const generator = arcGenerator<unknown>({
    innerRadius,
    outerRadius,
    cornerRadius,
    padAngle,
  });
  return generator({ startAngle, endAngle } as unknown as null) || "";
}

// Helper to check if a child is a PieCenter component
function isPieCenter(child: ReactNode): boolean {
  return (
    isValidElement(child) &&
    typeof child.type === "function" &&
    ((child.type as { displayName?: string }).displayName === "PieCenter" ||
      (child.type as { name?: string }).name === "PieCenter")
  );
}

function isPieSlice(child: ReactNode): boolean {
  // `PieSlice` is `memo()`-wrapped, so `child.type` is an OBJECT
  // (`$$typeof: react.memo`), not a function — a `typeof === "function"`
  // guard here would never match a real `<PieSlice>` element. Read
  // displayName/name off whatever `child.type` is instead of gating on its
  // typeof.
  if (!isValidElement(child)) {
    return false;
  }
  const type = child.type as { displayName?: string; name?: string } | string;
  if (typeof type === "string") {
    return false;
  }
  return type.displayName === "PieSlice" || type.name === "PieSlice";
}

// Helper to check if a component is a gradient or pattern definition
function isDefsComponent(child: ReactElement): boolean {
  const displayName =
    (child.type as { displayName?: string })?.displayName ||
    (child.type as { name?: string })?.name ||
    "";
  return (
    displayName.includes("Gradient") ||
    displayName.includes("Pattern") ||
    displayName === "LinearGradient" ||
    displayName === "RadialGradient"
  );
}

function PieChartInner(props: PieChartInnerProps) {
  const size = Math.min(props.width, props.height);

  if (size < 10) {
    return null;
  }

  return <PieChartCore {...props} />;
}

const PieChartCore = memo(function PieChartCore({
  width,
  height,
  data,
  innerRadius: innerRadiusProp,
  padAngle,
  cornerRadius,
  startAngle,
  endAngle,
  hoverOffset,
  children,
  containerRef,
  hoveredIndexProp,
  onHoverChange,
  enterTransition,
  enterStaggerScale,
  geometryScrubbing,
  radiusKey,
  referenceRings,
  seams,
  labels,
  sort,
  half,
  align = "start",
}: PieChartInnerProps) {
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null);
  const [animationKey] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  // Labels — RM-110/RM-114 integration: the sr-only seam `PieLabels` reports
  // an outside label it could not place into (see `pie-labels.tsx`). Always
  // created (cheap, no DOM) so the provider below is stable across renders;
  // the `<UnpaintedLabels>` sibling that actually paints is gated on `labels`.
  const unpaintedStore = useUnpaintedLabelsStore();

  // Use controlled or uncontrolled hover state
  const isControlled = hoveredIndexProp !== undefined;
  const hoveredIndex = isControlled ? hoveredIndexProp : internalHoveredIndex;
  const setHoveredIndex = useCallback(
    (index: number | null) => {
      if (isControlled) {
        onHoverChange?.(index);
      } else {
        setInternalHoveredIndex(index);
      }
    },
    [isControlled, onHoverChange],
  );

  // Use the smaller dimension to ensure the chart fits
  const size = Math.min(width, height);
  const center = size / 2;

  // `labels` (RM-114) resolves its `placement` per breakpoint HERE — the
  // nearest `ChartPlotRoot`'s `ChartBreakpointScope` is an ancestor of this
  // component, never of `PieChartBase`. Its default `{ base: "outside",
  // narrow: "none" }` means a `labels` prop with no `placement` shows nothing
  // at `narrow` — the legend/key carries the facts there instead.
  const breakpoint = useChartBreakpoint();
  const labelPlacement = labels
    ? resolveResponsive(labels.placement ?? DEFAULT_PIE_LABELS_PLACEMENT, breakpoint)
    : "none";

  // Calculate radii with padding based on hover offset to prevent clipping.
  // `referenceRings` (#RM-030) additionally reserves a leader-column gutter
  // (#246), and `labels="outside"` (RM-114) reserves a fixed gutter for its
  // leader + text, so neither ever clips the SVG bounds — a chart with
  // neither set keeps `padding === hoverOffset`, unchanged.
  const referenceRingGutter = pieReferenceRingGutter(radiusKey, referenceRings?.length ?? 0);
  const labelGutter = labelPlacement === "outside" ? PIE_OUTSIDE_LABEL_GUTTER : 0;
  const padding = hoverOffset + referenceRingGutter + labelGutter;
  const outerRadius = center - padding;
  // A value below 1 is a share of the outer radius (a 0.6 px hole was never a donut).
  const innerRadius =
    innerRadiusProp > 0 && innerRadiusProp < 1 ? outerRadius * innerRadiusProp : innerRadiusProp;

  // Calculate total value
  const totalValue = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  // Slice-label formatters (RM-114). `value` goes through the SET formatter
  // (#250 — every slice's value label shares one scale, so a $1,200 slice
  // never reads "1.2K" beside a $400 slice's "400"); `percent` is never
  // compacted, per `value-format.ts`. Cheap and hook-rules-safe to call even
  // when `labels` is unset — both formatters are internally memoized.
  const pieLabelValueFmt = useChartValueSetFormatter(
    data.map((d) => d.value),
    "compact",
  );
  const pieLabelPercentFmt = useChartValueFormatter("percent");

  // Decoration pattern fills
  const high = useHighDecorationOf(containerRef);
  const patternScope = useId().replace(/:/g, "");

  // radiusKey (#RM-030) — the max value of the second measure across `data`,
  // used to normalize every slice's radius scale. 0 when radiusKey is unset
  // or every value is missing/non-positive (in which case no slice scales).
  const radiusKeyMax = useMemo(() => {
    if (!radiusKey) return 0;
    return data.reduce((max, d) => {
      const raw = (d as unknown as Record<string, unknown>)[radiusKey];
      const v = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(v) && v > max ? v : max;
    }, 0);
  }, [data, radiusKey]);

  // Per-slice outer radius (area-honest: innerR + (R - innerR) * sqrt(v / max)).
  // `null` means "no override" — every slice renders at the uniform outerRadius,
  // which is exactly today's behavior when `radiusKey` is unset.
  const sliceOuterRadii = useMemo(() => {
    if (!radiusKey || radiusKeyMax <= 0) return null;
    return data.map((d) => {
      const raw = (d as unknown as Record<string, unknown>)[radiusKey];
      const v = typeof raw === "number" ? raw : Number(raw);
      const clean = Number.isFinite(v) && v > 0 ? v : 0;
      const ratio = Math.sqrt(clean / radiusKeyMax);
      return innerRadius + (outerRadius - innerRadius) * ratio;
    });
  }, [data, radiusKey, radiusKeyMax, innerRadius, outerRadius]);

  // referenceRings label layout (#246) — see `layoutPieReferenceRingLabels`.
  const referenceRingLabels = useMemo(() => {
    if (!radiusKey || !referenceRings || referenceRings.length === 0) {
      return [];
    }
    return layoutPieReferenceRingLabels(referenceRings, radiusKeyMax, innerRadius, outerRadius);
  }, [radiusKey, referenceRings, radiusKeyMax, innerRadius, outerRadius]);

  // Get color for a slice index
  const getColor = useCallback(
    (index: number) => {
      const item = data[index];
      if (item?.color) {
        return item.color;
      }
      return defaultPieColors[index % defaultPieColors.length] as string;
    },
    [data],
  );

  // Get fill for a slice index (supports patterns/gradients).
  // Under high decoration, palette-token slices get a decoration pattern.
  const getFill = useCallback(
    (index: number) => {
      const item = data[index];
      // Explicit fill always wins (author override)
      if (item?.fill) {
        return item.fill;
      }
      const color = getColor(index);
      // Decoration: auto-pattern for palette fills
      if (high && isPaletteFill(color)) {
        return `url(#${seriesPatternId(index, patternScope)})`;
      }
      return color;
    },
    [data, getColor, high, patternScope],
  );

  // Indices whose color is a palette fill (needs a <pattern> def at high decoration)
  const bpPatternIndices = useMemo(() => {
    if (!high) return [];
    return data
      .map((_, i) => i)
      .filter((i) => {
        const item = data[i];
        if (item?.fill) return false; // explicit fill wins
        return isPaletteFill(getColor(i));
      });
  }, [high, data, getColor]);

  // Compute arcs using d3-shape pie. `sort` (RM-114) only ever changes WHICH
  // angular slot a datum claims — d3's `pie()` always returns `arcs[i]` for
  // `data[i]` regardless of its sort comparator (see d3-shape's own
  // `pie.js`: "the arcs are stored in the original data's order"), so
  // `<PieSlice index={i}>` keeps targeting the same datum no matter how
  // `sort` is set. `"none"` reproduces the pre-RM-114 identity order
  // (`.sort(null)`); `"desc"` leaves d3-shape's OWN default in place
  // (`sortValues = descending` — largest slice at `startAngle`, then
  // clockwise by descending size).
  const arcs = useMemo(() => {
    const pieGenerator = d3Pie<PieData>()
      .value((d) => d.value)
      .startAngle(startAngle)
      .endAngle(endAngle)
      .padAngle(padAngle);
    if (sort === "none") {
      pieGenerator.sort(null);
    }

    const computed = pieGenerator(data);

    return computed.map((arc, index) => ({
      data: arc.data,
      index,
      startAngle: arc.startAngle,
      endAngle: arc.endAngle,
      padAngle: arc.padAngle,
      value: arc.value,
    })) as PieArcData[];
  }, [data, startAngle, endAngle, padAngle, sort]);

  const scrubSlicePaths = useMemo((): readonly string[] | null => {
    if (!geometryScrubbing) {
      return null;
    }
    return arcs.map((arc, index) =>
      generatePieArcPath(
        innerRadius,
        sliceOuterRadii ? (sliceOuterRadii[index] ?? outerRadius) : outerRadius,
        arc.startAngle,
        arc.endAngle,
        cornerRadius,
        arc.padAngle,
      ),
    );
  }, [geometryScrubbing, arcs, innerRadius, outerRadius, cornerRadius, sliceOuterRadii]);

  const datapointsEnabled = useChartDatapointsEnabled();
  const datapointTargets = useMemo(() => {
    if (!datapointsEnabled) {
      return EMPTY_PIE_TARGETS;
    }
    return arcs.map((arc) =>
      pieDatapointTarget(arc, {
        center,
        innerRadius,
        outerRadius: sliceOuterRadii ? (sliceOuterRadii[arc.index] ?? outerRadius) : outerRadius,
      }),
    );
  }, [arcs, center, datapointsEnabled, innerRadius, outerRadius, sliceOuterRadii]);
  useRegisterDatapointTargets("slices", datapointTargets);

  const effectiveIsLoaded = geometryScrubbing || isLoaded;

  // enterTransition replays enter.
  useEffect(() => {
    if (geometryScrubbing) {
      return;
    }
    setIsLoaded(false);
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [enterTransition, enterStaggerScale, geometryScrubbing]);

  // Separate children into categories
  const { svgChildren, centerChildren, defsChildren } = useMemo(() => {
    const svgNodes: ReactNode[] = [];
    const centerNodes: ReactNode[] = [];
    const defsNodes: ReactElement[] = [];

    Children.forEach(children, (child) => {
      if (!isValidElement(child)) {
        svgNodes.push(child);
        return;
      }

      if (isPieCenter(child)) {
        centerNodes.push(child);
      } else if (isDefsComponent(child)) {
        defsNodes.push(child);
      } else if (geometryScrubbing && isPieSlice(child)) {
        return;
      } else if (isPieSlice(child) && (sliceOuterRadii || seams > 0)) {
        // radiusKey / seams (#RM-030) — inject the per-slice outer radius
        // override and/or the paper-seam stroke via cloneElement, so PieSlice
        // stays context-free for this feature. A slice never rendered inside
        // a radiusKey/seams chart (outerRadiusOverride/seams both undefined)
        // is byte-identical to before.
        const sliceProps = child.props as PieSliceProps;
        const overrideRadius =
          sliceOuterRadii && typeof sliceProps.index === "number"
            ? sliceOuterRadii[sliceProps.index]
            : undefined;
        svgNodes.push(
          cloneElement<PieSliceProps>(child as ReactElement<PieSliceProps>, {
            outerRadiusOverride: overrideRadius,
            seams: seams > 0 ? seams : undefined,
          }),
        );
      } else {
        svgNodes.push(child);
      }
    });

    return {
      svgChildren: svgNodes,
      centerChildren: centerNodes,
      defsChildren: defsNodes,
    };
  }, [children, geometryScrubbing, sliceOuterRadii, seams]);

  const scrubSliceFills = useMemo(() => {
    if (!(geometryScrubbing && scrubSlicePaths)) {
      return null;
    }
    return scrubSlicePaths.map((_, index) => getFill(index));
  }, [geometryScrubbing, scrubSlicePaths, getFill]);

  const contextValue: PieContextValue = useMemo(
    () => ({
      data,
      arcs,
      size,
      center,
      outerRadius,
      innerRadius,
      padAngle,
      cornerRadius,
      hoverOffset,
      hoveredIndex,
      setHoveredIndex,
      animationKey,
      isLoaded: effectiveIsLoaded,
      enterTransition,
      enterStaggerScale,
      containerRef,
      totalValue,
      getColor,
      getFill,
      geometryScrubbing,
      scrubSlicePaths,
    }),
    [
      data,
      arcs,
      size,
      center,
      outerRadius,
      innerRadius,
      padAngle,
      cornerRadius,
      hoverOffset,
      hoveredIndex,
      setHoveredIndex,
      animationKey,
      effectiveIsLoaded,
      enterTransition,
      enterStaggerScale,
      containerRef,
      totalValue,
      getColor,
      getFill,
      geometryScrubbing,
      scrubSlicePaths,
    ],
  );

  // Use CSS Grid stacking to layer SVG and HTML content
  // This avoids Safari's foreignObject rendering bugs
  return (
    <PieProvider value={contextValue}>
      <UnpaintedLabelsProvider store={unpaintedStore}>
        <div
          className="grid"
          style={{
            gridTemplateColumns: "1fr",
            gridTemplateRows: "1fr",
            width: size,
            height: size,
            ...(align === "center" ? { marginInline: "auto" } : null),
          }}
        >
          {/* SVG layer with pie slices */}
          <svg
            aria-hidden="true"
            height={size}
            style={
              align === "center"
                ? { gridArea: "1 / 1", overflow: "visible" }
                : { gridArea: "1 / 1", contain: "layout style paint" }
            }
            width={size}
          >
            {/* Defs for patterns and gradients */}
            {(defsChildren.length > 0 || bpPatternIndices.length > 0) && (
              <defs>
                {defsChildren}
                {bpPatternIndices.map((i) =>
                  makeSeriesPattern(i, seriesPatternId(i, patternScope), getColor(i)),
                )}
              </defs>
            )}

            <Group left={center} top={center}>
              {/* radiusKey reference rings (#RM-030) — dashed value gridlines
                behind the slices, on the same sqrt(v / max) radius scale.
                Labels sit OUTSIDE outerRadius on a fixed-spacing leader
                column (#246) — never on the rings' own compressible radii,
                and never inside the plot where a slice could cover them. */}
              {radiusKey && referenceRings && referenceRings.length > 0 && radiusKeyMax > 0 ? (
                <g aria-hidden="true">
                  {referenceRingLabels.map((ring) => (
                    <circle
                      cx={0}
                      cy={0}
                      fill="none"
                      key={`pie-reference-ring-circle-${ring.value}`}
                      r={ring.ringRadius}
                      stroke={pieCssVars.foregroundMuted}
                      strokeDasharray="4 3"
                      strokeWidth={1}
                    />
                  ))}
                  {referenceRingLabels.map((ring) => (
                    <g data-reference-ring-leader="" key={`pie-reference-ring-label-${ring.value}`}>
                      <line
                        stroke={pieCssVars.foregroundMuted}
                        strokeDasharray="1.5 2.5"
                        strokeWidth={1}
                        x1={0}
                        x2={0}
                        y1={-ring.ringRadius}
                        y2={-ring.leaderEndRadius}
                      />
                      <text
                        fill={pieCssVars.foregroundMuted}
                        fontSize={9}
                        textAnchor="middle"
                        x={0}
                        y={-ring.labelRadius}
                      >
                        {ring.value}
                      </text>
                    </g>
                  ))}
                </g>
              ) : null}
              {scrubSlicePaths && scrubSliceFills
                ? scrubSlicePaths.map((d, index) =>
                    d ? (
                      <path
                        d={d}
                        fill={scrubSliceFills[index]}
                        key={data[index]?.label ?? index}
                        pointerEvents="none"
                      />
                    ) : null,
                  )
                : null}
              {svgChildren}
              {/* Slice labels (RM-114) — painted OVER the slices, under nothing:
                inside labels sit on the wedge itself, outside labels + leaders
                sit past `outerRadius` in the gutter `labelGutter` reserved
                above. No-op (`null`) whenever `labels` is unset. */}
              {labels ? (
                <PieLabels
                  arcs={arcs}
                  center={center}
                  config={{ ...labels, placement: labelPlacement }}
                  getColor={getColor}
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
                  textFor={(index) => {
                    const datum = data[index];
                    return {
                      label: datum?.label,
                      value: pieLabelValueFmt(datum?.value ?? 0),
                      percent: pieLabelPercentFmt(
                        totalValue > 0 ? (datum?.value ?? 0) / totalValue : 0,
                      ),
                    };
                  }}
                />
              ) : null}
            </Group>
          </svg>

          {/* Keyboard drill-down targets — a positioned SIBLING of the
            aria-hidden <svg>, stacked in the same grid cell so the layer's
            coordinate space is the SVG's own (#349). */}
          {datapointsEnabled ? (
            <div className="relative" style={{ gridArea: "1 / 1" }}>
              <ChartDatapointLayer />
            </div>
          ) : null}

          {/* HTML layer with center content - stacked on top via grid.
            `half` (RM-114, the "election donut" preset) seats the arc across
            the top half only, so the centre slot is anchored to the flat
            base line and grows DOWN into the otherwise-empty bottom half,
            instead of sitting in the box's geometric middle. */}
          {centerChildren.length > 0 && (
            <div
              className="pointer-events-none flex justify-center"
              style={
                half
                  ? { gridArea: "1 / 1", alignItems: "flex-start", paddingTop: center }
                  : { gridArea: "1 / 1", alignItems: "center" }
              }
            >
              {centerChildren}
            </div>
          )}
        </div>
        {/* Labels — RM-110/RM-114 integration: restates any outside label
          `layoutOutsideLabels` dropped for collision (`pie-labels.tsx`).
          Renders nothing when `labels` is unset OR nothing was dropped —
          byte-identical DOM either way. */}
        {labels ? <UnpaintedLabels store={unpaintedStore} /> : null}
      </UnpaintedLabelsProvider>
    </PieProvider>
  );
}, pieChartCorePropsEqual);

function pieChartCorePropsEqual(prev: PieChartInnerProps, next: PieChartInnerProps): boolean {
  return (
    prev.width === next.width &&
    prev.height === next.height &&
    prev.data === next.data &&
    prev.innerRadius === next.innerRadius &&
    prev.padAngle === next.padAngle &&
    prev.cornerRadius === next.cornerRadius &&
    prev.startAngle === next.startAngle &&
    prev.endAngle === next.endAngle &&
    prev.hoverOffset === next.hoverOffset &&
    prev.hoveredIndexProp === next.hoveredIndexProp &&
    prev.onHoverChange === next.onHoverChange &&
    prev.enterTransition === next.enterTransition &&
    prev.enterStaggerScale === next.enterStaggerScale &&
    prev.geometryScrubbing === next.geometryScrubbing &&
    prev.radiusKey === next.radiusKey &&
    prev.referenceRings === next.referenceRings &&
    prev.seams === next.seams &&
    prev.labels === next.labels &&
    prev.sort === next.sort &&
    prev.half === next.half &&
    prev.children === next.children
  );
}

// Unwrapped implementation; the public docblock sits on `PieChart` below.
const PieChartBase = forwardRef<HTMLDivElement, PieChartProps>(function PieChart(
  {
    data,
    size: fixedSize,
    plotHeight,
    innerRadius = 0,
    padAngle = 0,
    cornerRadius = 0,
    startAngle = -Math.PI / 2,
    endAngle = (3 * Math.PI) / 2,
    className = "",
    hoveredIndex: hoveredIndexProp,
    onHoverChange: onHoverChangeProp,
    hoverOffset = DEFAULT_HOVER_OFFSET,
    enterTransition,
    enterStaggerScale = 1,
    geometryScrubbing = false,
    radiusKey,
    referenceRings,
    seams = 0,
    labels,
    legend,
    groupSmall,
    sort: sortProp,
    half = false,
    align = "start",
    children,
    copyValueOnActivate,
    onDatapointClick,
    datapointLabel,
    maxInteractiveDatapoints,
    accessibleLabel,
    accessibleDescription,
  },
  ref,
) {
  // `half` (RM-114) is a hard preset: -π/2 → π/2, overriding any
  // `startAngle`/`endAngle` the caller passed.
  const effectiveStartAngle = half ? -Math.PI / 2 : startAngle;
  const effectiveEndAngle = half ? Math.PI / 2 : endAngle;
  // DEVIATION from the RM text (recorded in the result file): the RM asks
  // `sort` to default to `"desc"`. Doing so reorders every existing pie's
  // wedge ANGLES (never a `<PieSlice index={i}>`'s datum — see `arcs`'s
  // docblock in `PieChartCore`, d3-shape always returns arcs in input
  // order), which broke `chart-selection.test.tsx`'s byte-exact "pre-RM-073
  // DOM" baseline for `pie-chart`, a previously-accepted test this item may
  // not relax (`.claude/scratch/…/RM-114-brief.md` lesson #2). Defaulting to
  // `"none"` keeps every existing pie/donut byte-identical; `sort="desc"` is
  // fully implemented and a one-line opt-in for a new chart that wants it.
  const effectiveSort = sortProp ?? "none";

  // `groupSmall` (RM-114) folds the smallest slices into one "Other" before
  // ANYTHING downstream (arcs, legend, children) sees `data` — see
  // `pie-grouping.ts`. A chart with `groupSmall` unset never runs this.
  const groupedData = useMemo(
    () => (groupSmall ? groupSmallSlices(data, groupSmall).data : data),
    [data, groupSmall],
  );

  // Setting `groupSmall` hands slice rendering to `PieChart` itself: the
  // folded slice count no longer matches whatever `PieSlice` elements the
  // caller's `children` enumerated against the ORIGINAL `data`, so those are
  // dropped (kept: `PieCenter`, defs/gradients, anything else) and replaced
  // with one auto `<PieSlice index={i}>` per resulting slice. `groupSmall`
  // unset renders `children` verbatim — today's behavior.
  const effectiveChildren = useMemo(() => {
    if (!groupSmall) return children;
    const kept: ReactNode[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child) && isPieSlice(child)) return;
      kept.push(child);
    });
    return [
      ...groupedData.map((_, i) => <PieSlice index={i} key={`pie-auto-slice-${i}`} />),
      ...kept,
    ];
  }, [groupSmall, children, groupedData]);

  // Legend engine — RM-118. One swatch per (post-groupSmall) slice, in data
  // order — `<PieSlice index={i}>` and d3-shape's `arcs[i]` both key on that
  // SAME order regardless of `sort` (see `effectiveSort`'s docblock above),
  // so a legend-hover index maps onto a slice index with no translation.
  const legendItems: ChartLegendEntry[] = useMemo(
    () =>
      groupedData.map((d, i) => ({
        key: `${d.label}-${i}`,
        label: d.label,
        color: d.color ?? (defaultPieColors[i % defaultPieColors.length] as string),
        kind: "color" as const,
        // F09: the slice's own value, printed only with `legend={{ values: true }}`.
        value: d.value,
      })),
    [groupedData],
  );

  // One hover state, two sources: a pointer over a slice (PieSlice → the
  // context's `setHoveredIndex`, wired below) and a legend item (hover or
  // focus). Lifting the controlled/uncontrolled merge PieChartCore already
  // did up to this level means both sources write into the exact same
  // value, so a legend hover dims every other slice identically to a
  // pointer hover — Pie's existing hover seam, reused rather than doubled.
  const [internalHoveredIndex, setInternalHoveredIndex] = useState<number | null>(null);
  const hoverIsControlled = hoveredIndexProp !== undefined;
  // #610: a faceted AutoChart's ONE shared legend names a slice by LABEL (the
  // grid's panels each hold their own rows, so indices differ per panel) —
  // it applies only while this pie's own hover is empty.
  const sharedLegendHoveredKey = useSharedLegendHoveredKey();
  const sharedHoveredIndex = useMemo(() => {
    if (sharedLegendHoveredKey == null) return null;
    const index = groupedData.findIndex((d) => d.label === sharedLegendHoveredKey);
    return index >= 0 ? index : null;
  }, [groupedData, sharedLegendHoveredKey]);
  const effectiveHoveredIndex = hoverIsControlled
    ? (hoveredIndexProp as number | null)
    : (internalHoveredIndex ?? sharedHoveredIndex);
  const handleHoverChange = useCallback(
    (index: number | null) => {
      if (hoverIsControlled) {
        onHoverChangeProp?.(index);
      } else {
        setInternalHoveredIndex(index);
      }
    },
    [hoverIsControlled, onHoverChangeProp],
  );

  const containerLegend = useContainerLegend({
    legend,
    items: legendItems,
    hoveredIndex: effectiveHoveredIndex,
    onHoverChange: handleHoverChange,
    // Pie has no hide-a-slice wiring yet (R3) — see the `legend` prop's JSDoc.
    maxInteractive: "hover",
  });

  // containerRef anchors tooltips; merged with the forwarded ref via callback ref
  const containerRef = useRef<HTMLDivElement>(null);
  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Keep internal containerRef in sync for tooltip positioning
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      // Forward to the caller's ref
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  // Labels — RM-110: the auto summary stands in for a missing accessibleDescription.
  const description = useChartAutoSummary("pie", {
    accessibleLabel,
    accessibleDescription,
    data,
  });
  const {
    role,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedby,
    tabIndex,
    descId,
  } = useChartA11yContainerProps(accessibleLabel, description); // Labels — RM-110

  // If fixed size is provided, use it directly
  // The provider sits ABOVE the chart body so `PieSlice` can read the
  // drill-down activator and the core can register slice targets (#349).
  const withInteraction = (chart: ReactNode) =>
    onDatapointClick || copyValueOnActivate ? (
      <ChartDatapointProvider
        datapointLabel={datapointLabel}
        maxInteractiveDatapoints={maxInteractiveDatapoints}
        copyValueOnActivate={copyValueOnActivate}
        onDatapointClick={onDatapointClick}
      >
        {chart}
      </ChartDatapointProvider>
    ) : (
      chart
    );

  if (fixedSize) {
    return containerLegend.wrap(
      <ChartPlotRoot
        aria-describedby={ariaDescribedby}
        aria-label={ariaLabel}
        className={cn("relative flex items-center justify-center", className)}
        ref={mergedRef}
        role={role}
        style={{ width: fixedSize, height: fixedSize }}
        tabIndex={tabIndex}
      >
        <ChartA11yLabel descId={descId} description={description} />
        {withInteraction(
          <PieChartInner
            containerRef={containerRef}
            cornerRadius={cornerRadius}
            data={groupedData}
            endAngle={effectiveEndAngle}
            enterStaggerScale={enterStaggerScale}
            enterTransition={enterTransition}
            geometryScrubbing={geometryScrubbing}
            align={align}
            half={half}
            height={fixedSize}
            hoveredIndexProp={effectiveHoveredIndex}
            hoverOffset={hoverOffset}
            innerRadius={innerRadius}
            labels={labels}
            onHoverChange={handleHoverChange}
            padAngle={padAngle}
            radiusKey={radiusKey}
            referenceRings={referenceRings}
            seams={seams}
            sort={effectiveSort}
            startAngle={effectiveStartAngle}
            width={fixedSize}
          >
            {effectiveChildren}
          </PieChartInner>,
        )}
      </ChartPlotRoot>,
    );
  }

  // Otherwise use ParentSize for responsive sizing
  return containerLegend.wrap(
    <ChartPlotRoot
      plotBox={{ plotHeight, defaultPlotHeight: { aspect: 1 } }}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      ref={mergedRef}
      role={role}
      tabIndex={tabIndex}
    >
      <ChartA11yLabel descId={descId} description={description} />
      <ParentSize debounceTime={10}>
        {({ width, height }) =>
          withInteraction(
            <PieChartInner
              containerRef={containerRef}
              cornerRadius={cornerRadius}
              data={groupedData}
              endAngle={effectiveEndAngle}
              enterStaggerScale={enterStaggerScale}
              enterTransition={enterTransition}
              geometryScrubbing={geometryScrubbing}
              align={align}
              half={half}
              height={height}
              hoveredIndexProp={effectiveHoveredIndex}
              hoverOffset={hoverOffset}
              innerRadius={innerRadius}
              labels={labels}
              onHoverChange={handleHoverChange}
              padAngle={padAngle}
              radiusKey={radiusKey}
              referenceRings={referenceRings}
              seams={seams}
              sort={effectiveSort}
              startAngle={effectiveStartAngle}
              width={width}
            >
              {effectiveChildren}
            </PieChartInner>,
          )
        }
      </ParentSize>
    </ChartPlotRoot>,
  );
});

PieChartBase.displayName = "PieChartBase";

// Selection input (RM-073): mounted outermost so marks AND the datapoint
// layer's accessible names read it; with `selectionStates` unset it adds no DOM.
/**
 * @dataShape parts of a whole across a few categories, read as proportions of the total
 * @avoidWhen more than about 6 slices — use a bar or unit chart
 */
export const PieChart = forwardRef<HTMLDivElement, PieChartProps>(function PieChart(props, ref) {
  return (
    <ChartSelectionProvider dimExcluded={props.dimExcluded} selectionStates={props.selectionStates}>
      <PieChartBase {...props} ref={ref} />
    </ChartSelectionProvider>
  );
});
PieChart.displayName = "PieChart";

export default PieChart;
