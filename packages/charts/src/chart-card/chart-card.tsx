"use client";

import { type HTMLAttributes, type ReactNode, forwardRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Skeleton,
  useLocale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface ChartCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /**
   * Write the title as the CONCLUSION, not the chart type — "Revenue is up
   * 8% QoQ", not "Revenue chart". Put what each series means in prose in
   * `description` (lieflat's card contract).
   */
  title: ReactNode;
  /**
   * Prose that IS the legend — what a reader needs to read the chart
   * correctly (series, units, scope), written as a sentence, not a caption.
   */
  description?: ReactNode;
  /** Header actions (range picker, menu). */
  actions?: ReactNode;
  /** The chart itself. Bring your own chart lib (Recharts, visx, etc.). */
  children: ReactNode;
  /** Fixed body height so charts have a sizing context. Defaults to 260. */
  height?: number;
  /**
   * Loading vs ready — the body becomes a layout-shaped skeleton at the same
   * height; title/description keep rendering. Default: `false`.
   */
  loading?: boolean;
  /**
   * Attribution / provenance footer — e.g. "Source: Internal analytics,
   * updated daily". Renders as the card's all-caps, letter-spaced source row
   * (the fourth part of lieflat's card contract); hidden when absent.
   */
  source?: ReactNode;
}

/**
 * Presentational container for a chart. Intentionally chart-library-agnostic:
 * pass a Recharts/visx/Chart.js element as children and use the `--chart-1..12`
 * tokens for series colors so charts theme with the rest of the system.
 */
export const ChartCard = forwardRef<HTMLDivElement, ChartCardProps>(function ChartCard(
  {
    title,
    description,
    actions,
    children,
    height = 260,
    loading = false,
    source,
    className,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  return (
    <Card ref={ref} className={cn("flex flex-col", className)} {...props}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      </CardHeader>
      <CardContent className="flex-1">
        <div
          style={{ height }}
          className="w-full"
          {...(loading ? { role: "status", "aria-live": "polite" as const } : {})}
        >
          {loading ? (
            <>
              <span className="sr-only">{t("charts.chart.loading")}</span>
              <Skeleton className="size-full" />
            </>
          ) : (
            children
          )}
        </div>
      </CardContent>
      {source ? (
        <CardFooter className="pt-0">
          <p className="w-full truncate text-chart-source text-chart-foreground-muted uppercase">
            {source}
          </p>
        </CardFooter>
      ) : null}
    </Card>
  );
});
