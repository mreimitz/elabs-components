"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  forwardRef,
} from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useLocale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

/**
 * The card contract's fourth part — the attribution/source row (RM-019).
 * Always `truncate`s so a long source cannot blow out the footer; a string
 * source gets a native `title` unconditionally (cheap, hover-recoverable) and,
 * once the row measurably overflows, the keyboard-reachable `Tooltip` too, so
 * the full text is recoverable without a mouse and without selecting text
 * (#184). A short source gains neither the tab stop nor the tooltip. A
 * non-string `source` keeps only the CSS-driven caps — see the `source`
 * docblock on `ChartCardProps`/`ChartFrameProps` for why that case is the
 * caller's responsibility.
 *
 * The `<p>` stays the same element regardless of `overflows` — only its
 * trailing `TooltipContent` sibling is conditional — so a mid-lifecycle flip
 * (a resize, a shorter `source` arriving) never remounts the row itself.
 */
export function ChartSourceRow({ source, className }: { source: ReactNode; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);
  const text = typeof source === "string" ? source : undefined;

  // No dependency array: re-measures on every commit (mount, content change,
  // container resize via the observer below) rather than trying to enumerate
  // every input that can change the row's intrinsic vs. available width.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  });

  const showTooltip = Boolean(text) && overflows;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <p
            ref={ref}
            tabIndex={showTooltip ? 0 : undefined}
            title={text}
            className={cn(
              "truncate text-chart-source text-chart-foreground-muted uppercase",
              className,
            )}
          >
            {source}
          </p>
        </TooltipTrigger>
        {showTooltip ? <TooltipContent>{text}</TooltipContent> : null}
      </Tooltip>
    </TooltipProvider>
  );
}

export interface ChartCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /**
   * Write the title as the CONCLUSION, not the chart type — "Revenue is up
   * 8% QoQ", not "Revenue chart". Put what each series means in prose in
   * `description` (lieflat's card contract).
   */
  title: ReactNode;
  /**
   * Heading level for the card's title, forwarded to `CardTitle`'s own
   * `as` prop (#328). Set this when the card titles a real page section so
   * it contributes to the document outline.
   * @default "div"
   */
  titleAs?: "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
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
   * (the fourth part of lieflat's card contract); hidden when absent. A
   * string that overflows the row stays fully recoverable — a native `title`
   * and, once it measurably overflows, a keyboard-reachable tooltip (#184). A
   * non-string node keeps only the CSS caps with no overflow recovery — keep
   * it short, or accept it may be visually truncated with no fallback.
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
    titleAs,
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
    // `min-w-0`: as a grid/flex item the card must shrink to its track, not to
    // its content's min-content width (2026-09-21 new-user test: a two-column
    // chart grid pushed the page wider than a 390 px viewport).
    <Card ref={ref} className={cn("flex min-w-0 flex-col", className)} {...props}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle as={titleAs} className="text-base">
            {title}
          </CardTitle>
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
        // `pb-3` (tighter than the card's default `pb-6`) reads as a
        // footnote sitting close to the card's edge, not a fourth content
        // block equidistant from the chart above and the edge below (#184).
        <CardFooter className="pt-0 pb-3">
          <ChartSourceRow source={source} className="w-full" />
        </CardFooter>
      ) : null}
    </Card>
  );
});
