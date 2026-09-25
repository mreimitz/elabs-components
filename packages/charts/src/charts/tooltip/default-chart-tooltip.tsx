import { Children, isValidElement, useMemo, type ReactNode } from "react";
import { ChartTooltip } from "./chart-tooltip";

/**
 * Hover readout by default. The cartesian containers (`LineChart`,
 * `AreaChart`, `BarChart`, `ScatterChart`, `ComposedChart`,
 * `CandlestickChart`) used to show a tooltip only when the caller remembered
 * a `<ChartTooltip />` child — and many did not, so a chart you could hover
 * told you nothing. Now a container with no `<ChartTooltip>` child appends a
 * default one; `tooltip={false}` opts out, and an explicit child (with its
 * own `variant`/`rows`/`content`) always wins over the default.
 *
 * Found by component name, anywhere in the child tree (fragments and wrapper
 * elements included) — the same name-based seam the shells already use to
 * hand a `<ChartTooltip>` its `YAxis` unit hint. A caller's OWN component that
 * renders `<ChartTooltip>` internally is invisible to this walk: pass
 * `tooltip={false}` beside it. A host that wants no hover feedback at all
 * sets `ChartConfigProvider`/`ChartFrame` `interactions={{ passive: false }}`.
 */
function isChartTooltipElement(type: unknown): boolean {
  if (type === ChartTooltip) return true;
  if (typeof type !== "function") return false;
  const named = type as { displayName?: string; name?: string };
  return (named.displayName || named.name) === "ChartTooltip";
}

export function hasChartTooltipChild(children: ReactNode): boolean {
  let found = false;
  const visit = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (found || !isValidElement(child)) return;
      if (isChartTooltipElement(child.type)) {
        found = true;
        return;
      }
      const inner = (child.props as { children?: ReactNode } | null)?.children;
      if (inner) visit(inner);
    });
  };
  visit(children);
  return found;
}

/**
 * `children` plus a default `<ChartTooltip />` when `enabled` and none is
 * present. Returned as a flat, keyed array — never a fragment — because the
 * shells classify their DIRECT children with `Children.forEach`, which does
 * not look inside a fragment.
 */
export function withDefaultChartTooltip(children: ReactNode, enabled: boolean): ReactNode {
  if (!enabled || hasChartTooltipChild(children)) return children;
  return [...Children.toArray(children), <ChartTooltip key="default-chart-tooltip" />];
}

/** Memoised so a container's own re-render (legend hover, phase) keeps the same `children` reference for its memoised shell. */
export function useDefaultChartTooltip(children: ReactNode, enabled = true): ReactNode {
  return useMemo(() => withDefaultChartTooltip(children, enabled), [children, enabled]);
}
