"use client";

import { type HTMLAttributes, type ReactNode, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Card, CardContent } from "../card";
import { CopyableValue } from "../copyable-value";
import { Skeleton } from "../skeleton";
import { useLocale } from "../locale-provider";
import { cn } from "../../lib/cn";
import {
  type NumberFormat,
  type ResolvedNumberFormat,
  resolveNumberFormat,
} from "../../lib/compact-number";

/**
 * Applies a {@link ResolvedNumberFormat}'s `prefix`/`suffix`/`parens` on top
 * of the plain `Intl` string `formatNumber` produces — the two things Intl
 * itself cannot render (RM-109). Twin of `formatResolvedChartValue`
 * (`packages/charts/src/charts/chart-formatters.ts`).
 */
function formatResolvedNumber(
  resolved: ResolvedNumberFormat,
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string,
  value: number,
): string {
  const numeric = formatNumber(resolved.parens ? Math.abs(value) : value, resolved.options);
  const signed = resolved.parens && value < 0 ? `(${numeric})` : numeric;
  return `${resolved.prefix}${signed}${resolved.suffix}`;
}

/*
 * ADR 0012: this is the ONE KPI tile — `@elabs-ai/components-charts` re-exports it.
 * RM-072 adds `size` (sm | md | lg) for dashboard-sheet tiles and a `sparkline`
 * slot under the value. `ui` never imports `charts`: the host passes the
 * `<Sparkline …/>` element in.
 */

/*
 * `emphasis` — size/weight/space ONLY, no new hue (research 11 §B.5 KPI-1/5):
 * `headline` is the answer-leading rung (`text-kpi`, ~32px); `default` stays
 * calm on the intermediate 1.5rem reading rung (the pre-#188 step between
 * `title` and `kpi` — no app role exists there, same precedent as the prose
 * h1/h3 rungs; baselined in the text-scale ratchet).
 */
const metricValueVariants = cva("tabular-nums text-foreground", {
  variants: {
    emphasis: {
      default: "text-2xl font-semibold tracking-tight",
      headline: "text-kpi",
    },
    /* `md` adds nothing (today's rungs); `sm`/`lg` override the size via `cn()`. */
    size: {
      sm: "text-title",
      md: "",
      lg: "text-kpi",
    },
  },
  defaultVariants: { emphasis: "default", size: "md" },
});

const metricContentVariants = cva("space-y-2", {
  variants: {
    emphasis: {
      default: "p-5",
      headline: "p-6",
    },
    size: {
      sm: "space-y-1 p-3",
      md: "",
      lg: "p-6",
    },
  },
  defaultVariants: { emphasis: "default", size: "md" },
});

const metricSparklineVariants = cva("", {
  variants: {
    size: {
      /* never rendered — `sm` drops the slot; kept so the axis is total */
      sm: "",
      md: "pt-1",
      lg: "min-h-12 pt-2",
    },
  },
  defaultVariants: { size: "md" },
});

export type MetricCardEmphasis = NonNullable<VariantProps<typeof metricValueVariants>["emphasis"]>;

/**
 * Tile tier (RM-072). `sm`: label + value only (no icon, delta, description,
 * sparkline, visual or evidence); `md`: the default tile; `lg`: the kpi value
 * rung with more room for the `sparkline` slot.
 */
export type MetricCardSize = NonNullable<VariantProps<typeof metricValueVariants>["size"]>;

/**
 * How a NUMERIC `value` is rendered. A function takes over completely.
 *
 * `"compact"` is the default because a KPI tile is a small box and
 * `50012102.632741` does not fit in one — the exact figure stays one click
 * away via `CopyableValue`. Anything that is not a `number` (a string, an
 * element) is passed through untouched, so every existing call site is
 * unaffected.
 *
 * Also accepts the object form (RM-109, `NumberFormatSpec` —
 * `{ decimals, abbreviate, sign, prefix, suffix, … }`,
 * `packages/ui/src/lib/compact-number.ts`) for a tile that needs e.g.
 * `{ decimals: 1, suffix: "%" }` without hand-formatting the string itself.
 * The two preset-string cases render byte-for-byte as before this type
 * widened — only a spec OBJECT argument reaches the new code path.
 */
export type MetricCardValueFormat = NumberFormat | ((value: number) => ReactNode);

export interface MetricCardProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof metricValueVariants> {
  label: ReactNode;
  value: ReactNode;
  /**
   * How to render a NUMERIC `value`. Default: `"compact"`. Ignored for every
   * other `ReactNode` — a string you already formatted is rendered verbatim.
   */
  valueFormat?: MetricCardValueFormat;
  /** ISO 4217 code for `valueFormat: "currency"`. Default: `"USD"`. */
  currency?: string;
  /**
   * Offer the exact figure on click when a numeric `value` was shortened.
   * Default: `true`. Turning it off leaves a compacted number with no way back
   * to its digits, so only do that when the tile is decorative.
   */
  copyExactValue?: boolean;
  /** Secondary line under the value — sublabel / context. */
  description?: ReactNode;
  /** Signed change, e.g. "+12.4%". Direction colors it. */
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  /** Whether "up" is good (green) — flip for metrics where down is good. */
  positiveIsGood?: boolean;
  icon?: ReactNode;
  /** Optional inline visual shown under the value/description. */
  visual?: ReactNode;
  /**
   * Trend slot rendered directly under the value (RM-072) — pass a
   * `<Sparkline …/>` from `@elabs-ai/components-charts`. Hidden at `size="sm"`.
   */
  sparkline?: ReactNode;
  /**
   * Optional grounding footer (research 11 §B.5 KPI-3) — connects a cited
   * figure to its source (e.g. an `EvidenceChip` from `@elabs-ai/components-ai`). Rendered
   * subdued (`text-meta text-muted-foreground`) under the tile body.
   */
  evidence?: ReactNode;
  /**
   * Loading vs ready — renders a layout-shaped skeleton (matching the real
   * box height) instead of the value/label/delta text. Default: `false`.
   */
  loading?: boolean;
  /**
   * Whether this tile announces its own `loading` state via a live region.
   * Set to `false` when several tiles are composed inside a container that
   * already announces once for the whole region (e.g. a loading
   * `MetricGrid`) — see loading-states.md §a11y ("one live region per
   * region, not per box"). Default: `true`.
   */
  announceLoading?: boolean;
}

/** Compact KPI tile for dashboards. */
export const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(function MetricCard(
  {
    label,
    value,
    valueFormat = "compact",
    currency,
    copyExactValue = true,
    description,
    delta,
    deltaDirection = "neutral",
    positiveIsGood = true,
    icon,
    visual,
    sparkline,
    evidence,
    emphasis,
    size,
    loading = false,
    announceLoading = true,
    className,
    ...props
  },
  ref,
) {
  const { t, formatNumber } = useLocale();

  // Formatting applies to NUMBERS only. Every shipped call site passes a string
  // it formatted itself, so this branch is inert for them — that is what makes
  // a new default safe.
  const isNumeric = typeof value === "number";
  const formattedValue: ReactNode = !isNumeric
    ? value
    : typeof valueFormat === "function"
      ? valueFormat(value)
      : formatResolvedNumber(
          resolveNumberFormat(valueFormat, value, currency),
          formatNumber,
          value,
        );
  // Only offer the exact figure when the display actually differs from it —
  // a button around a value that was never shortened is noise.
  const showsExact = isNumeric && String(formattedValue) === String(value);
  const canCopyExact =
    isNumeric && copyExactValue && typeof valueFormat !== "function" && !showsExact;

  const good =
    deltaDirection === "up" ? positiveIsGood : deltaDirection === "down" ? !positiveIsGood : null;
  const deltaColor =
    good === null ? "text-muted-foreground" : good ? "text-success-text" : "text-destructive-text";
  // Stable, theme-agnostic polarity hook. High decoration reveals a non-color
  // polarity glyph from this attribute (decoration.css); chromatic themes ignore it
  // and use color. Issue #162.
  const polarity = good === null ? "neutral" : good ? "good" : "bad";
  const arrow = deltaDirection === "up" ? "↑" : deltaDirection === "down" ? "↓" : "";
  // Direction is conveyed visually by the arrow glyph + color; give AT a single
  // unambiguous name ("up 12.4%, favorable") since neither the glyph nor color is a
  // reliable signal (high decoration / high-contrast collapse the hue) — and good/bad
  // polarity is otherwise invisible to AT. See accessibility.md, #162.
  const directionLabel = deltaDirection === "up" ? "up" : deltaDirection === "down" ? "down" : "";
  const polarityLabel = good === null ? "" : good ? ", favorable" : ", unfavorable";
  // `sm` is label + value only: every secondary row is dropped (RM-072).
  const compact = size === "sm";
  const valueClassName = cn(metricValueVariants({ emphasis, size }));

  return (
    <Card ref={ref} className={cn("overflow-hidden", className)} {...props}>
      <CardContent
        className={cn(metricContentVariants({ emphasis, size }))}
        {...(loading && announceLoading ? { role: "status", "aria-live": "polite" as const } : {})}
      >
        {loading && announceLoading ? (
          <span className="sr-only">{t("ui.metricCard.loading")}</span>
        ) : null}
        <div className="flex items-center justify-between">
          {loading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            /* `min-w-0` + `truncate`, not just the text utility: a flex child's
               default `min-width: auto` refuses to shrink below its content, so
               without it the label OVERFLOWS the row and `Card`'s own
               `overflow-hidden` hard-clips it — characters lost mid-word, no
               ellipsis, no title. Measured on a 230px pane: "Awaiting approval"
               rendered as "Awaiting approva". See interaction-guidelines.md
               § Content handling ("flex children need `min-w-0`"). `title` only
               when the label is a string — there is nothing to put in the
               attribute otherwise, and the ellipsis needs a way back to the
               full words. */
            <span
              className="min-w-0 truncate text-body font-medium text-muted-foreground"
              title={typeof label === "string" ? label : undefined}
            >
              {label}
            </span>
          )}
          {/* `shrink-0`: the icon is a fixed 16px mark, so the LABEL is what
              gives way when the row runs out of width. */}
          {icon && !compact ? (
            <span className="shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>
          ) : null}
        </div>
        <div className="flex items-baseline gap-2">
          {loading ? (
            <Skeleton className={emphasis === "headline" ? "h-9 w-28" : "h-8 w-24"} />
          ) : canCopyExact ? (
            <CopyableValue
              className={valueClassName}
              // Two tiles in one grid can compact to the same display ("$1.2M"),
              // and the visible label is a sibling node the button's name does
              // not include — so without this a screen-reader user tabbing the
              // grid hears the identical name twice. A non-string label has no
              // text to borrow; the default hint stands.
              hint={
                typeof label === "string" ? `${label}, ${t("ui.copyableValue.hint")}` : undefined
              }
              value={String(value)}
            >
              {formattedValue}
            </CopyableValue>
          ) : (
            <span className={valueClassName}>{formattedValue}</span>
          )}
          {delta && !compact ? (
            loading ? (
              <Skeleton className="h-4 w-14" />
            ) : (
              <span
                data-polarity={polarity}
                className={cn("text-meta tabular-nums", deltaColor)}
                aria-label={
                  directionLabel ? `${directionLabel} ${delta}${polarityLabel}` : undefined
                }
              >
                {arrow ? <span aria-hidden="true">{arrow} </span> : null}
                {delta}
              </span>
            )
          ) : null}
        </div>
        {sparkline && !compact ? (
          <div className={metricSparklineVariants({ size })}>
            {loading ? <Skeleton className="h-8 w-full" /> : sparkline}
          </div>
        ) : null}
        {description && !compact ? (
          loading ? (
            <Skeleton className="h-3 w-32" />
          ) : (
            <p className="text-meta font-normal text-muted-foreground">{description}</p>
          )
        ) : null}
        {visual && !compact ? (
          <div className="pt-1">{loading ? <Skeleton className="h-8 w-full" /> : visual}</div>
        ) : null}
        {evidence && !compact ? (
          <div className="pt-1 text-meta font-normal text-muted-foreground">
            {loading ? <Skeleton className="h-3 w-24" /> : evidence}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
});
