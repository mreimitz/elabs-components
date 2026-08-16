"use client";

import { type HTMLAttributes, type ReactNode, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Card, CardContent } from "../card";
import { CopyableValue } from "../copyable-value";
import { Skeleton } from "../skeleton";
import { useLocale } from "../locale-provider";
import { cn } from "../../lib/cn";
import { type NumberFormatKind, numberFormatOptions } from "../../lib/compact-number";

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
  },
  defaultVariants: { emphasis: "default" },
});

const metricContentVariants = cva("space-y-2", {
  variants: {
    emphasis: {
      default: "p-5",
      headline: "p-6",
    },
  },
  defaultVariants: { emphasis: "default" },
});

export type MetricCardEmphasis = NonNullable<VariantProps<typeof metricValueVariants>["emphasis"]>;

/**
 * How a NUMERIC `value` is rendered. A function takes over completely.
 *
 * `"compact"` is the default because a KPI tile is a small box and
 * `50012102.632741` does not fit in one — the exact figure stays one click
 * away via `CopyableValue`. Anything that is not a `number` (a string, an
 * element) is passed through untouched, so every existing call site is
 * unaffected.
 */
export type MetricCardValueFormat = NumberFormatKind | ((value: number) => ReactNode);

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
  /** Optional inline visual (e.g. a sparkline) shown under the value/description. */
  visual?: ReactNode;
  /**
   * Optional grounding footer (research 11 §B.5 KPI-3) — connects a cited
   * figure to its source (e.g. an `EvidenceChip` from `@elabs/components-ai`). Rendered
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
    evidence,
    emphasis,
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
      : formatNumber(value, numberFormatOptions(valueFormat, value, currency));
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

  return (
    <Card ref={ref} className={cn("overflow-hidden", className)} {...props}>
      <CardContent
        className={metricContentVariants({ emphasis })}
        {...(loading && announceLoading ? { role: "status", "aria-live": "polite" as const } : {})}
      >
        {loading && announceLoading ? (
          <span className="sr-only">{t("ui.metricCard.loading")}</span>
        ) : null}
        <div className="flex items-center justify-between">
          {loading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <span className="text-body font-medium text-muted-foreground">{label}</span>
          )}
          {icon ? <span className="text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
        </div>
        <div className="flex items-baseline gap-2">
          {loading ? (
            <Skeleton className={emphasis === "headline" ? "h-9 w-28" : "h-8 w-24"} />
          ) : canCopyExact ? (
            <CopyableValue
              className={metricValueVariants({ emphasis })}
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
            <span className={metricValueVariants({ emphasis })}>{formattedValue}</span>
          )}
          {delta ? (
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
        {description ? (
          loading ? (
            <Skeleton className="h-3 w-32" />
          ) : (
            <p className="text-meta font-normal text-muted-foreground">{description}</p>
          )
        ) : null}
        {visual ? (
          <div className="pt-1">{loading ? <Skeleton className="h-8 w-full" /> : visual}</div>
        ) : null}
        {evidence ? (
          <div className="pt-1 text-meta font-normal text-muted-foreground">
            {loading ? <Skeleton className="h-3 w-24" /> : evidence}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
});
