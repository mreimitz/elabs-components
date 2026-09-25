"use client";

import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { MetricCard, RevealGroup, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface MetricGridProps {
  /** Optional so a `loading` grid can render its placeholder shape before any tiles exist. */
  children?: ReactNode;
  /**
   * Target columns once the grid's own container is wide enough (container
   * queries, not the viewport — see `colsMap`). Defaults to 4.
   */
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
  /**
   * Lands on the grid element itself (inside the `@container` wrapper), so
   * `gap-*`, margins and test hooks merge as before; a class that must sit on
   * the OUTER box in a parent grid (`col-span-*`) goes on a wrapper of your own.
   */
  className?: string;
  /**
   * Loading vs ready — forwards `loading` to every child tile; when there are
   * no children yet, renders `columns` placeholder `MetricCard`s so the grid
   * reserves its final shape. Default: `false`.
   */
  loading?: boolean;
}

// Container queries, not viewport breakpoints (ADR 0039: a surface measures its
// OWN container). A KPI band in a dashboard column or a split pane gets the
// track count its width can pay for, not the one the window's width implies —
// four tiles crushed into a 448px column was the viewport version's failure.
// Rungs (Tailwind container sizes): `@sm` 24rem → 2 tracks (~11rem a tile),
// `@2xl` 42rem → 3, `@4xl` 56rem → 4 (~13rem a tile). The 4-column map skips
// the 3-track rung so a full band never orphans one tile on a second row.
const colsMap = {
  2: "@sm:grid-cols-2",
  3: "@sm:grid-cols-2 @2xl:grid-cols-3",
  4: "@sm:grid-cols-2 @4xl:grid-cols-4",
} as const;

// The span may only widen at the rung where the grid actually has that many
// tracks — a `col-span-3` inside a 2-track grid forces an implicit column.
const spanMap = {
  2: { 2: "@sm:col-span-2", 3: "@sm:col-span-2", 4: "@sm:col-span-2" },
  3: {
    2: "@sm:col-span-2",
    3: "@sm:col-span-2 @2xl:col-span-3",
    4: "@sm:col-span-2 @4xl:col-span-3",
  },
} as const;

type SpannableChild = ReactElement<{
  className?: string;
  loading?: boolean;
  announceLoading?: boolean;
}>;

/**
 * Responsive grid for a row of <MetricCard />s.
 *
 * The ref lands on the grid element — the same node as `className` and the
 * loading status region — not on the `@container` wrapper around it.
 */
export const MetricGrid = forwardRef<HTMLDivElement, MetricGridProps>(function MetricGrid(
  { children, columns = 4, reveal = false, featured, featuredSpan = 2, className, loading = false },
  ref,
) {
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
      <div className="@container w-full">
        <div ref={ref} className={gridClassName} {...notReadyProps}>
          {loadingLabel}
          {Array.from({ length: columns }, (_, index) => (
            <MetricCard key={index} announceLoading={false} label="" loading value="" />
          ))}
        </div>
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
              ? cn(el.props.className, spanMap[Math.min(featuredSpan, columns) as 2 | 3][columns])
              : el.props.className,
            ...(loading && isMetricCard ? { loading: true, announceLoading: false } : {}),
          });
        });

  if (reveal) {
    return (
      <div className="@container w-full">
        <RevealGroup
          ref={ref}
          appear="up"
          speed="base"
          staggerMs={60}
          className={gridClassName}
          {...notReadyProps}
        >
          {loadingLabel}
          {items}
        </RevealGroup>
      </div>
    );
  }

  return (
    <div className="@container w-full">
      <div ref={ref} className={gridClassName} {...notReadyProps}>
        {loadingLabel}
        {items}
      </div>
    </div>
  );
});

MetricGrid.displayName = "MetricGrid";
