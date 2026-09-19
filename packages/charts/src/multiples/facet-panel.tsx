"use client";

/**
 * One cell of a `ChartMultiples` grid (RM-120): the panel title slot above a
 * normal chart container. The cell publishes the panel's facet scope, its plot
 * height (the `plotHeight` rung a frame uses) and keeps the value axis at a
 * narrow panel width — a small multiple without its scale is unreadable, so a
 * panel keeps `md` furniture at `narrow` unless the host names a `narrow`
 * density itself. Each panel still measures its OWN `data-chart-breakpoint`.
 */
import { forwardRef, type HTMLAttributes, type ReactNode, useId, useMemo } from "react";
import { cn } from "@elabs-ai/components-ui";

import {
  ChartFramePlotHeightProvider,
  type ChartPlotHeight,
  isResponsiveByBreakpoint,
  type Responsive,
  resolveResponsive,
} from "../charts/chart-breakpoint";
import {
  type ChartDensity,
  type ChartFacetScopeValue,
  ChartConfigValueProvider,
  ChartFacetScopeProvider,
  useChartConfig,
} from "../charts/chart-config-context";

/** A panel keeps its host density at `narrow` (the value axis stays) unless the host says otherwise. */
export function facetPanelDensity(density: Responsive<ChartDensity>): Responsive<ChartDensity> {
  if (isResponsiveByBreakpoint(density)) {
    return density.narrow !== undefined
      ? density
      : { ...density, narrow: resolveResponsive(density, "narrow") };
  }
  return { base: density, narrow: density };
}

export interface FacetPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The panel's scope for the chart inside. */
  scope: ChartFacetScopeValue;
  /** The panel's plot height (the frame rung of `plotHeight`). */
  plotHeight: Responsive<ChartPlotHeight>;
  /** Title slot content (the default title, or the caller's `panelTitle`). */
  title: ReactNode;
  children?: ReactNode;
}

export const FacetPanel = forwardRef<HTMLDivElement, FacetPanelProps>(function FacetPanel(
  { scope, plotHeight, title, children, className, ...props },
  ref,
) {
  const titleId = useId();
  const config = useChartConfig();
  const panelConfig = useMemo(
    () => ({
      ...config,
      densityByBreakpoint: facetPanelDensity(config.densityByBreakpoint ?? config.density),
    }),
    [config],
  );
  return (
    <div
      ref={ref}
      aria-labelledby={titleId}
      className={cn("flex min-w-0 flex-col gap-1", className)}
      data-panel-key={scope.panelKey}
      data-slot="chart-multiples-panel"
      role="group"
      {...props}
    >
      <div className="min-w-0" data-slot="chart-multiples-panel-title" id={titleId}>
        {title}
      </div>
      <ChartConfigValueProvider value={panelConfig}>
        <ChartFramePlotHeightProvider value={plotHeight}>
          <ChartFacetScopeProvider value={scope}>{children}</ChartFacetScopeProvider>
        </ChartFramePlotHeightProvider>
      </ChartConfigValueProvider>
    </div>
  );
});
