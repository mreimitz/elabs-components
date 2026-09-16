"use client";

/**
 * ChartFallback — shared placeholder panel for "there's nothing usable to chart".
 *
 * Originally private to `auto-chart.tsx` (bad/missing `ChartSpec` data or an
 * unsupported chart type). Promoted to its own module (#352) so the cartesian
 * time-series shell (`TimeSeriesChartCore`, used by both `LineChart` and
 * `AreaChart`) can reach it too, for the identical "nothing usable to render"
 * case — every x value fails to parse as a Date, so there is no scale to draw
 * with — WITHOUT creating a `charts/ -> auto-chart/ -> charts/` import cycle
 * (`auto-chart` imports FROM `charts`, never the reverse). `auto-chart.tsx`
 * re-exports this component so `ChartFallback` keeps its existing place in the
 * public `@elabs-ai/components-charts` surface.
 */

import { forwardRef, type HTMLAttributes } from "react";
import { cn, useLocale } from "@elabs-ai/components-ui";

/**
 * Which "nothing to chart" state the panel reports. The kind owns BOTH the
 * default copy and the live-region semantics, so a caller cannot get one right
 * and the other wrong (#304):
 *
 * - `"empty"` — no usable rows. A settled empty result that can arrive after a
 *   data change, so it stays a polite `role="status"` region (unchanged).
 * - `"unsupported"` — the spec names a chart the library cannot draw. A settled
 *   result, not a progress update, so it is a plain container: no `role`, no
 *   `aria-live`. The copy is about the reader's screen, never the library's
 *   roadmap; the unsupported type name goes to a dev warning, not the DOM.
 */
export type ChartFallbackKind = "empty" | "unsupported";

export interface ChartFallbackProps extends HTMLAttributes<HTMLDivElement> {
  /** The state being reported. Default `"empty"`. */
  kind?: ChartFallbackKind;
  /**
   * Overrides the localised default text for `kind`. Pass an already-localised
   * string — the panel renders it as-is.
   */
  message?: string;
}

const DEFAULT_MESSAGE_KEY: Record<ChartFallbackKind, string> = {
  empty: "charts.chart.empty",
  unsupported: "charts.chart.unsupported",
};

export const ChartFallback = forwardRef<HTMLDivElement, ChartFallbackProps>(function ChartFallback(
  { kind = "empty", message, className, ...props },
  ref,
) {
  const { t } = useLocale();
  const liveRegion =
    kind === "empty" ? ({ role: "status", "aria-live": "polite" } as const) : undefined;
  return (
    <div
      ref={ref}
      data-slot="chart-fallback"
      data-kind={kind}
      className={cn(
        // border-border keeps the placeholder boundary visible even in themes
        // where --surface-muted is close to --background (e.g. a low-chroma theme).
        "flex items-center justify-center rounded-md border border-border bg-surface-muted text-muted-foreground text-body",
        className,
      )}
      {...liveRegion}
      {...props}
    >
      {message ?? t(DEFAULT_MESSAGE_KEY[kind])}
    </div>
  );
});
