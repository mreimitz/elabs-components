"use client";

import { cn, useLocale } from "@elabs-ai/components-ui";
import type { LineConfig } from "./chart-context";
import { useChartSeriesMode } from "./time-series-chart-shell";

export interface SeriesFocusTargetsProps {
  /** The chart's own series configs (`dataKey`/`name`), in draw order. */
  lines: readonly Pick<LineConfig, "dataKey" | "name">[];
  /**
   * The container legend engine's own `visible` (RM-118) — a visible legend
   * already ships a keyboard-reachable, `onFocus`/`onBlur`-wired item per
   * series (`ChartLegend`), so this layer stays out of the way rather than
   * add a second, redundant tab stop for the same series.
   */
  legendVisible?: boolean;
  className?: string;
}

/**
 * issue 545: a minimal, always-available keyboard path to `focusOnHover`'s
 * (RM-112) spotlight/dim for `LineChart`/`AreaChart`'s OWN DEFAULT
 * configuration — no `legend` required. Without this, a keyboard user had
 * NO way to reach the spotlight at all unless the consumer also opted into
 * `legend` (`ChartLegend`'s own, separately-fixed `onFocus`/`onBlur`).
 *
 * One real `<button>` per series, invisible until it is the focused element
 * itself (the `SkipLink` `sr-only focus-visible:not-sr-only` pattern,
 * `@elabs-ai/components-ui`) — a positioned sibling of the chart's own
 * `aria-hidden` `<svg>`, never a target ON an SVG shape
 * (`.claude/rules/charts.md` "Drill-down": keyboard targets live outside the
 * `<svg>`). Focusing a target calls the SAME `setHoveredKey` the direct
 * pointer-hover-on-a-series'-own-shape path already uses
 * (`series-hover-dim.tsx`'s `focusHandlers`) — no new dim logic, only a new
 * way to reach the existing one.
 *
 * Reads `focusOnHover` from context (not a prop): `ChartSeriesModeProvider`
 * already ORs the container's own `focusOnHover` prop with a `<ChartTooltip
 * focus>`'s `setFocusRequested` (RM-119) — so mounting this unconditionally
 * beside `TimeSeriesChartInner` also gives `<ChartTooltip focus>`'s
 * standalone focus-dim registration the same keyboard path, with no changes
 * to `chart-tooltip.tsx` at all: the same root gap, the same fix.
 */
export function SeriesFocusTargets({
  lines,
  legendVisible = false,
  className,
}: SeriesFocusTargetsProps) {
  const { focusOnHover, setHoveredKey } = useChartSeriesMode();
  const { t } = useLocale();

  if (!focusOnHover || legendVisible || lines.length === 0) {
    return null;
  }

  return (
    <div
      aria-label={t("charts.seriesFocus.groupLabel")}
      className={cn("pointer-events-none absolute inset-0", className)}
      data-slot="series-focus-targets"
      role="group"
    >
      {lines.map((line) => (
        <button
          className="sr-only pointer-events-auto focus-visible:not-sr-only focus-visible:absolute focus-visible:start-0 focus-visible:top-0 focus-visible:z-10 focus-visible:block focus-visible:rounded-md focus-visible:bg-card focus-visible:px-2 focus-visible:py-1 focus-visible:text-caption focus-visible:text-foreground focus-visible:shadow-ring-sm focus-ring"
          data-slot="series-focus-target"
          key={line.dataKey}
          onBlur={() => setHoveredKey(null)}
          onFocus={() => setHoveredKey(line.dataKey)}
          type="button"
        >
          {t("charts.seriesFocus.itemLabel", { series: line.name ?? line.dataKey })}
        </button>
      ))}
    </div>
  );
}

SeriesFocusTargets.displayName = "SeriesFocusTargets";
