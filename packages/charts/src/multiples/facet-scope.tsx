"use client";

/**
 * How a chart container applies its `ChartMultiples` panel scope (RM-120).
 * Containers call {@link useFacetScopedChildren} on their own children; the
 * transform only fills DEFAULTS — an explicit prop on the child always wins —
 * and it is the identity outside a panel, so an unfaceted chart's DOM is
 * unchanged.
 */
import { curveMonotoneX, line as d3Line } from "d3-shape";
import {
  Children,
  cloneElement,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useMemo,
} from "react";

import { chartCssVars, useChartStable, useYScale } from "../charts/chart-context";
import { type ChartFacetScopeValue, useChartFacetScope } from "../charts/chart-config-context";

/** Stroke width of the muted baseline series (thinner than a panel series' 2 px). */
const FACET_BASELINE_STROKE_WIDTH = 1.5;

function childName(child: ReactElement): string {
  const type = child.type as { displayName?: string; name?: string } | string;
  if (typeof type === "string") return "";
  return type.displayName || type.name || "";
}

/** Whether a value axis at `orientation` paints labels in this panel under shared y. */
function paintsValueAxis(scope: ChartFacetScopeValue, orientation: unknown): boolean {
  if (!scope.sharedY) return true;
  return orientation === "right"
    ? scope.column === scope.columns - 1 || scope.columns === 1
    : scope.column === 0;
}

/**
 * The panel defaults applied to a container's direct children:
 * - `YAxis`: `ticks` from the scope (range rounding / shared ticks); dropped in
 *   a panel that is not the outer column under shared y.
 * - `Grid`: `rowTickValues` from the scope, so gridlines match the ticks.
 * - `XAxis`: dropped above the bottom panel of its column under shared x.
 * - a muted {@link FacetBaseline} is prepended (painted behind every series).
 */
export function applyFacetScope(
  children: ReactNode,
  scope: ChartFacetScopeValue,
  options: FacetScopeOptions = {},
): ReactNode {
  const out: ReactNode[] = [];
  if (scope.baselineKey && (options.baseline ?? true)) {
    out.push(createElement(FacetBaseline, { dataKey: scope.baselineKey, key: "facet-baseline" }));
  }
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      out.push(child);
      return;
    }
    const props = child.props as Record<string, unknown>;
    const name = childName(child);
    if (name === "YAxis") {
      if (!paintsValueAxis(scope, props.orientation)) return;
      out.push(
        scope.yTicks && props.ticks === undefined && props.yAxisId == null
          ? cloneElement(child as ReactElement<{ ticks?: number[] }>, { ticks: scope.yTicks })
          : child,
      );
      return;
    }
    if (name === "Grid") {
      out.push(
        scope.yTicks && props.rowTickValues === undefined
          ? cloneElement(child as ReactElement<{ rowTickValues?: number[] }>, {
              rowTickValues: scope.yTicks,
            })
          : child,
      );
      return;
    }
    if (name === "XAxis" && scope.sharedX && !scope.bottom) return;
    out.push(child);
  });
  return out;
}

export interface FacetScopeOptions {
  /** Prepend the muted baseline series. Default `true`; families without a time/series x pass `false`. */
  baseline?: boolean;
}

/** `applyFacetScope` against the enclosing panel scope; identity outside one. */
export function useFacetScopedChildren(
  children: ReactNode,
  options: FacetScopeOptions = {},
): ReactNode {
  const scope = useChartFacetScope();
  const baseline = options.baseline ?? true;
  return useMemo(
    () => (scope ? applyFacetScope(children, scope, { baseline }) : children),
    [children, scope, baseline],
  );
}

export interface FacetBaselineProps {
  /** Row key of the baseline values. */
  dataKey: string;
}

/**
 * The muted reference series a panel repeats behind its own series. Ink only
 * (`aria-hidden` via the chart's svg); its values are not a datapoint target.
 */
export function FacetBaseline({ dataKey }: FacetBaselineProps) {
  const { data, xAccessor, xScale } = useChartStable();
  const yScale = useYScale();
  const path = useMemo(() => {
    const draw = d3Line<Record<string, unknown>>()
      .defined((row) => typeof row[dataKey] === "number" && Number.isFinite(row[dataKey]))
      .x((row) => xScale(xAccessor(row)) ?? 0)
      .y((row) => yScale(row[dataKey] as number) ?? 0)
      .curve(curveMonotoneX);
    return draw(data as Record<string, unknown>[]) ?? "";
  }, [data, dataKey, xAccessor, xScale, yScale]);
  if (!path) return null;
  return (
    <path
      d={path}
      data-slot="chart-multiples-baseline"
      fill="none"
      pointerEvents="none"
      stroke={chartCssVars.foregroundMuted}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={FACET_BASELINE_STROKE_WIDTH}
    />
  );
}
FacetBaseline.displayName = "FacetBaseline";
