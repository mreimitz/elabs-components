"use client";

import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { MetricCard, RevealGroup, useLocale } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";

export interface MetricGridProps {
  /** Optional so a `loading` grid can render its placeholder shape before any tiles exist. */
  children?: ReactNode;
  /** Target columns at the largest breakpoint. Defaults to 4. */
  columns?: 2 | 3 | 4;
  /** Stagger the tiles in on mount. Motion-gated. Defaults to false (dashboards opt in). */
  reveal?: boolean;
  /**
   * Index of the tile that spans wider (research 11 §B.5 KPI-2) — pairs with
   * `<MetricCard emphasis="headline">` so the headline KPI out-ranks the band.
   */
  featured?: number;
  /** Columns the featured tile spans at the larger breakpoints. Defaults to 2. */
  featuredSpan?: 2 | 3;
  className?: string;
  /**
   * Loading vs ready — forwards `loading` to every child tile; when there are
   * no children yet, renders `columns` placeholder `MetricCard`s so the grid
   * reserves its final shape. Default: `false`.
   */
  loading?: boolean;
}

const colsMap = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

// `sm` caps at 2 tracks (colsMap), so a span of 3 only widens further at `lg`.
const spanMap = {
  2: "sm:col-span-2",
  3: "sm:col-span-2 lg:col-span-3",
} as const;

type SpannableChild = ReactElement<{
  className?: string;
  loading?: boolean;
  announceLoading?: boolean;
}>;

/** Responsive grid for a row of <MetricCard />s. */
export function MetricGrid({
  children,
  columns = 4,
  reveal = false,
  featured,
  featuredSpan = 2,
  className,
  loading = false,
}: MetricGridProps) {
  const { t } = useLocale();
  const gridClassName = cn("grid grid-cols-1 gap-4", colsMap[columns], className);
  const loadingLabelText = t("charts.metricGrid.loading");
  // The grid is the region — it owns the single live-region announcement, so
  // every child tile is told to stay silent (`announceLoading={false}`) and
  // avoid flooding AT with one status per tile (loading-states.md §a11y).
  // `role="status"` computes its accessible name from `author` (aria-label),
  // NOT from content (per the ARIA spec — the same reason `Spinner` carries
  // an `aria-label` rather than relying on visible/sr-only text); pair it with
  // an `aria-label` here too, mirroring that convention.
  const notReadyProps = loading
    ? {
        role: "status" as const,
        "aria-live": "polite" as const,
        "aria-label": loadingLabelText,
      }
    : undefined;
  // Hoisted so all three render branches (empty-placeholder / reveal / plain
  // div) share the exact same announcement — none of them may render the
  // status region without it (loading-states.md §a11y, "announce the state
  // once at the region").
  const loadingLabel = loading ? <span className="sr-only">{loadingLabelText}</span> : null;

  // No data yet — reserve the final grid shape with placeholder tiles
  // instead of collapsing to an empty row.
  if (loading && Children.count(children) === 0) {
    return (
      <div className={gridClassName} {...notReadyProps}>
        {loadingLabel}
        {Array.from({ length: columns }, (_, index) => (
          <MetricCard key={index} announceLoading={false} label="" loading value="" />
        ))}
      </div>
    );
  }

  // Clone (no wrapper element — same approach as RevealGroup) so the featured
  // tile stays a direct grid child and the span class lands on the tile itself.
  const items =
    featured === undefined && !loading
      ? children
      : Children.map(children, (child, index) => {
          if (!isValidElement<{ className?: string; loading?: boolean }>(child)) {
            return child;
          }
          const el = child as SpannableChild;
          const isFeatured = featured !== undefined && index === featured;
          // Only forward the loading/announceLoading pair onto an actual
          // MetricCard — an arbitrary child (a wrapping Tooltip/Link, a plain
          // div, per MetricGridProps["children"]: ReactNode) doesn't accept
          // those props and would leak `loading`/`announceLoading` onto its
          // DOM node as unknown attributes.
          const isMetricCard = el.type === MetricCard;
          return cloneElement(el, {
            className: isFeatured
              ? cn(el.props.className, spanMap[Math.min(featuredSpan, columns) as 2 | 3])
              : el.props.className,
            ...(loading && isMetricCard ? { loading: true, announceLoading: false } : {}),
          });
        });

  if (reveal) {
    return (
      <RevealGroup
        appear="up"
        speed="base"
        staggerMs={60}
        className={gridClassName}
        {...notReadyProps}
      >
        {loadingLabel}
        {items}
      </RevealGroup>
    );
  }

  return (
    <div className={gridClassName} {...notReadyProps}>
      {loadingLabel}
      {items}
    </div>
  );
}
