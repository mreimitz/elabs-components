/**
 * analytics/scatter-trend-alias.ts — `<Scatter trend>` (RM-115) as an alias of
 * `analytics: [{ kind: "trend", of: dataKey, model }]` (RM-139).
 *
 * The deprecated child prop keeps its exact painted output — `TrendLine`'s
 * `data-slot="scatter-trend-line"` with `data-r2` / `data-trend`, and its own
 * sentence in the scatter auto summary — while the fit becomes the shared
 * analytics trend: it gains the legend entry ("Trend (r² 0.82)") and the
 * tooltip row, and `describeScatterTrends` and `TrendLine` both read
 * `fitModel`, the one regression implementation. The derived layer does NOT
 * paint an alias (the host's `legacyTrendIds`), so nothing draws twice.
 *
 * Framework-free: reads element props only.
 */

import { Children, isValidElement, type ReactNode } from "react";
import type { AnalyticTrend, ChartAnalytic } from "./types";

/** The id an aliased `Scatter trend` gets. */
export function scatterTrendAliasId(dataKey: string): string {
  return `scatter-trend-${dataKey}`;
}

/** Every `<Scatter trend>` child, as trend analytics (tree order). */
export function scatterTrendAliases(children: ReactNode): AnalyticTrend[] {
  const out: AnalyticTrend[] = [];
  const visit = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      const props = child.props as { trend?: unknown; dataKey?: unknown; children?: ReactNode };
      if (
        (props.trend === "linear" || props.trend === "log") &&
        typeof props.dataKey === "string"
      ) {
        out.push({
          kind: "trend",
          of: props.dataKey,
          model: props.trend,
          id: scatterTrendAliasId(props.dataKey),
        });
      }
      if (props.children) visit(props.children);
    });
  };
  visit(children);
  return out;
}

/**
 * The caller's `analytics` plus the aliased trends (skipping an alias whose
 * series already has an explicit `trend` analytic), and the alias ids.
 */
export function mergeScatterTrendAliases(
  analytics: readonly ChartAnalytic[] | undefined,
  aliases: readonly AnalyticTrend[],
): { analytics: readonly ChartAnalytic[] | undefined; legacyIds: ReadonlySet<string> } {
  if (aliases.length === 0) return { analytics, legacyIds: new Set() };
  const explicit = new Set(
    (analytics ?? []).filter((a) => a.kind === "trend").map((a) => a.of ?? ""),
  );
  const kept = aliases.filter((alias) => !explicit.has(alias.of ?? ""));
  return {
    analytics: [...(analytics ?? []), ...kept],
    legacyIds: new Set(kept.map((alias) => alias.id as string)),
  };
}
