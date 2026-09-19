"use client";

/**
 * One cell of a `ChartMultiples` grid (RM-120): the panel title slot above a
 * normal chart container. The cell publishes the panel's facet scope, its plot
 * height (the `plotHeight` rung a frame uses) and the furniture density of the
 * HOST grid's tier: panels are narrow by construction, so their density follows
 * the grid's width, not their own (a 2 × 2 grid at 900 px keeps its value axes;
 * at a 380 px host the maintainer narrow default applies). Each panel still
 * measures its OWN `data-chart-breakpoint`.
 */
import { forwardRef, type HTMLAttributes, type ReactNode, useId, useMemo } from "react";
import { cn } from "@elabs-ai/components-ui";

import {
  type ChartBreakpoint,
  ChartFramePlotHeightProvider,
  type ChartPlotHeight,
  type Responsive,
  resolveDensityForBreakpoint,
} from "../charts/chart-breakpoint";
import {
  type ChartDensity,
  type ChartFacetScopeValue,
  ChartConfigValueProvider,
  ChartFacetScopeProvider,
  useChartConfig,
} from "../charts/chart-config-context";

/**
 * The density every panel uses: the host density resolved at the HOST grid's
 * tier (so an explicit host `narrow` entry still wins), pinned for every panel
 * tier — a panel's own narrow width never drops its value axis on its own.
 */
export function facetPanelDensity(
  density: Responsive<ChartDensity>,
  hostBreakpoint: ChartBreakpoint,
): Responsive<ChartDensity> {
  const resolved = resolveDensityForBreakpoint(density, hostBreakpoint);
  return { base: resolved, narrow: resolved };
}

export interface FacetPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The panel's scope for the chart inside. */
  scope: ChartFacetScopeValue;
  /** The panel's plot height (the frame rung of `plotHeight`). */
  plotHeight: Responsive<ChartPlotHeight>;
  /** The host grid's tier; panel furniture density resolves from it. */
  hostBreakpoint: ChartBreakpoint;
  /** Title slot content (the default title, or the caller's `panelTitle`). */
  title: ReactNode;
  children?: ReactNode;
}

export const FacetPanel = forwardRef<HTMLDivElement, FacetPanelProps>(function FacetPanel(
  { scope, plotHeight, hostBreakpoint, title, children, className, ...props },
  ref,
) {
  const titleId = useId();
  const config = useChartConfig();
  const panelConfig = useMemo(
    () => ({
      ...config,
      densityByBreakpoint: facetPanelDensity(
        config.densityByBreakpoint ?? config.density,
        hostBreakpoint,
      ),
    }),
    [config, hostBreakpoint],
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
