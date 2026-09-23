"use client";

import {
  type ComponentType,
  createContext,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
  useContext,
  useMemo,
} from "react";
import { cn } from "@elabs-ai/components-ui";
import { AnalyticSeriesLayer } from "../analytics/analytic-series-layer";
import { type AnalyticsSourceSeries, useChartAnalyticsHost } from "../analytics/analytics-context";
import type { ChartAnalytic } from "../analytics/types";
import { useChartFramePlotHeight } from "../chart-breakpoint";
import type { ChartValueFormat } from "../value-format";
import { AnnotationKey } from "./annotation-key";
import { AnnotationLayoutProvider } from "./annotation-layout-context";
import { type ChartAnnotation, withAnnotationDescription } from "./annotation-types";
import { AnnotationScalesContext, ChartAnnotations } from "./chart-annotations";
import type { AnnotationScales } from "./resolve-annotation-position";

/** The props a container needs to host annotations. */
export interface ChartAnnotationsHostProps {
  children?: ReactNode;
  accessibleDescription?: string;
  /**
   * Declarative annotations in data units (RM-111): text notes, ranges,
   * reference lines and row notes. Ranges paint under the series, the rest
   * over them; at the `narrow` tier each text note becomes a numbered marker
   * listed in a key under the plot, and every annotation is restated once in
   * the figure description.
   */
  annotations?: readonly ChartAnnotation[];
  /**
   * Statistical overlays computed from `data` (RM-138 / RM-139, ADR 0040 §1):
   * computed `line`/`band`s join `annotations`; `trend`/`window`/`forecast`/
   * `errorBars` draw as derived series.
   */
  analytics?: readonly ChartAnalytic[];
  /** Read by the analytics host (never required by the annotation host). */
  data?: unknown;
  xDataKey?: string;
  orientation?: "vertical" | "horizontal";
  valueFormat?: ChartValueFormat;
  currency?: string;
}

/** Container defaults the analytics host needs when the caller left them unset. */
export interface AnnotatedChartOptions {
  /** The container's own `xDataKey` default (`"date"` for time series, `"name"` for bars). */
  xDataKey?: string;
  /** The drawn axis the values run along when `orientation` is unset. */
  valueAxis?: "x" | "y";
  /** The value series, for a container whose values are not `dataKey` children. */
  series?: readonly AnalyticsSourceSeries[];
  /** The x axis is continuous (scatter): an `x` analytic reduces the x column. */
  xContinuous?: boolean;
  /** Derived series another painter draws (the deprecated `Scatter trend` alias). */
  legacyTrendIds?: ReadonlySet<string>;
}

/**
 * Render a cartesian container with its `annotations` prop applied (RM-111).
 * Called from the container's public `forwardRef` (so docgen and the
 * `charts-responsive` rule still see a `forwardRef` export); the container
 * body itself is untouched: this appends a `ChartAnnotations` child (which the
 * shell paints in its back and front passes), merges the restatement into
 * `accessibleDescription`, and stacks an `AnnotationKey` under the plot box,
 * so the key adds to the total height and never eats the drawing.
 *
 * With no annotations it renders the container alone: the DOM is identical to
 * the container without this prop.
 */
export function useAnnotatedChart<P extends ChartAnnotationsHostProps>(
  Plot: ComponentType<P & RefAttributes<HTMLDivElement>>,
  props: P,
  ref: ForwardedRef<HTMLDivElement>,
  /**
   * `children` (default): append a `ChartAnnotations` child for the shell to
   * paint. `context`: publish the annotations for a container that draws its
   * own plot and mounts the layers with `useChartAnnotationLayers`.
   */
  mount: "children" | "context" = "children",
  options: AnnotatedChartOptions = {},
): ReactElement {
  const fill = useChartFramePlotHeight() === "fill";
  const { annotations: ownAnnotations, analytics, ...rest } = props;
  const plotProps = rest as unknown as P;
  // Analytics — RM-138 / RM-139: computed lines/bands become annotations,
  // derived series a layer child; unset `analytics` keeps the DOM identical.
  const host = useChartAnalyticsHost({
    analytics,
    data: Array.isArray(props.data)
      ? (props.data as readonly Record<string, unknown>[])
      : undefined,
    xDataKey: props.xDataKey ?? options.xDataKey ?? "date",
    children: props.children,
    series: options.series,
    xContinuous: options.xContinuous,
    legacyTrendIds: options.legacyTrendIds,
    valueAxis:
      props.orientation === "horizontal"
        ? "x"
        : props.orientation === "vertical"
          ? "y"
          : (options.valueAxis ?? "y"),
    valueFormat: props.valueFormat,
    currency: props.currency,
  });
  const annotations =
    host.annotations.length > 0 ? [...(ownAnnotations ?? []), ...host.annotations] : ownAnnotations;
  // Derived series paint in two passes: their bands under the marks (the
  // first child), their paths and whiskers over them (the last).
  const hasDerived = host.derived.length > 0 && mount === "children";
  const derivedBack = hasDerived ? <AnalyticSeriesLayer layer="back" /> : null;
  // The front pass knows every reference line so a derived path's end tag
  // never prints over a line's label.
  const derivedLayer = hasDerived ? (
    <AnalyticSeriesLayer avoid={annotations} layer="front" />
  ) : null;
  if (!annotations?.length) {
    if (!host.active) return <Plot {...plotProps} ref={ref} />;
    return host.provide(
      <Plot {...plotProps} ref={ref}>
        {derivedBack}
        {props.children}
        {derivedLayer}
      </Plot>,
    ) as ReactElement;
  }
  // The caller's own annotations restate in the description as before; the
  // computed ones are described by the analytics sentence (`ChartA11yLabel`).
  const accessibleDescription = withAnnotationDescription(
    props.accessibleDescription,
    ownAnnotations,
  );
  const plot =
    mount === "context" ? (
      <ChartAnnotationsSlotContext.Provider value={annotations}>
        <Plot {...plotProps} accessibleDescription={accessibleDescription} ref={ref} />
      </ChartAnnotationsSlotContext.Provider>
    ) : (
      <Plot {...plotProps} accessibleDescription={accessibleDescription} ref={ref}>
        {derivedBack}
        {props.children}
        <ChartAnnotations annotations={annotations} />
        {derivedLayer}
      </Plot>
    );
  // One layout scope for the plot and its key: the key lists the notes the
  // layer had to demote to a numbered marker.
  return host.provide(
    <AnnotationLayoutProvider>
      <div
        className={cn("flex w-full flex-col", fill && "h-full min-h-0")}
        data-slot="chart-annotations-host"
      >
        {fill ? <div className="min-h-0 flex-1">{plot}</div> : plot}
        <AnnotationKey annotations={annotations} />
      </div>
    </AnnotationLayoutProvider>,
  ) as ReactElement;
}

/** The annotations a `context`-mounted container paints (see `useAnnotatedChart`). */
const ChartAnnotationsSlotContext = createContext<readonly ChartAnnotation[] | null>(null);

/**
 * The two annotation passes for a container that draws its own plot without a
 * `ChartProvider` (RM-111): render `back` before the marks and `front` after
 * them, inside the plot's translated group. `scales` maps data units onto the
 * plot; pass `null` when the current layout cannot place annotations. Both
 * passes are `null` when the container was given no annotations.
 */
export function useChartAnnotationLayers(scales: AnnotationScales | null): {
  back: ReactElement | null;
  front: ReactElement | null;
} {
  const annotations = useContext(ChartAnnotationsSlotContext);
  return useMemo(() => {
    if (!annotations?.length || !scales) return { back: null, front: null };
    const pass = (layer: "back" | "front") => (
      <AnnotationScalesContext.Provider value={scales}>
        <ChartAnnotations annotations={annotations} layer={layer} />
      </AnnotationScalesContext.Provider>
    );
    return { back: pass("back"), front: pass("front") };
  }, [annotations, scales]);
}
