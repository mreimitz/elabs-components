"use client";

/**
 * ViewToolbar — the GRAMMAR for the one row that sits above every list, table
 * or board view (#331).
 *
 * The failure this fixes was ambiguity, not capability: with no named row
 * contract, ~40 routes of one consuming app grew 6 filter-chip idioms, 5
 * result-count renderings and ~11px of control-height scatter in a single filter
 * row. So the deliverable is a small, closed vocabulary — not a configurable
 * widget:
 *
 *   ⓘ info   │  ── left cluster: status · filters · count ──  │   actions
 *
 * - `ViewToolbar` is the row shell (slots only — it renders no view semantics).
 * - `ViewToolbarFilters` is the ONE home for active-filter chips + "clear all".
 * - `FilterChip` is the ONE removable chip (label-in-value, whole chip removes).
 * - `ResultCount` is the ONE count (`tabular-nums`, "N of M" when filtered).
 *
 * Deliberate non-decisions, so a reader doesn't mistake them for oversights:
 *
 * - **No `cva`.** None of the four parts has a second visual axis today, and the
 *   rules forbid dead variants. A sticky/bounded bar is a caller `className`
 *   recipe (documented in `Docs/View Toolbar Contract`), not a variant.
 * - **No `role="toolbar"` on the root.** That role promises roving-tabindex
 *   arrow-key navigation, which this row does not implement; claiming it would
 *   mislead assistive tech. Every control is an ordinary tab stop instead, and
 *   the one region that benefits from a name — the filter set — carries
 *   `role="group"` + an accessible name.
 * - **The row wraps; it never scrolls or clips.** A hard fixed height would put
 *   the action cluster out of reach at narrow widths (AC), so the row keeps a
 *   `min-h-9` floor (== `Button` default height, so single-line rows are
 *   consistent) and wraps beyond it. The action cluster wraps INTERNALLY too —
 *   a `shrink-0` cluster whose buttons cannot wrap simply overflows the row's
 *   box once the row is narrower than the buttons are wide (measured: it
 *   escaped by ~8px at a 320px viewport), which is the very thing the AC
 *   forbids. It stays right-aligned (`justify-end`) on every line.
 *
 * Relationship to neighbours: `PageShell`'s generic `header` slot is where this
 * row goes on a page (#367's toolbar header variant should PLACE a
 * `<ViewToolbar>`, not invent a second row concept). `@qlik-coe-emea/qlabs-components-data`'s `FilterBar`
 * stays the DataTable-scoped toolbar render-prop row; it could later be
 * recomposed on this shell, but that is a separate change.
 */
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { Info, X } from "lucide-react";
import { badgeVariants } from "../badge/badge";
import { Button } from "../button";
import { Skeleton } from "../skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";
import { useLocale } from "../locale-provider";
import { cn } from "../../lib/cn";

// ---------------------------------------------------------------------------
// ViewToolbar (the row shell)
// ---------------------------------------------------------------------------

export interface ViewToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * What this view is, as a tooltip on an ⓘ trigger at the start of the row —
   * so a view does not need an in-page `<h1>` + paragraph block just to explain
   * itself. Omit it when the surrounding page already says what the view is.
   *
   * **Pointer/keyboard only.** A Radix tooltip opens on hover and on keyboard
   * focus but deliberately NOT on tap (and Radix suppresses the focus-open when
   * focus arrived from a pointer), so on a touch device this text is
   * unreachable. Treat `info` as progressive enhancement: never put something a
   * phone user cannot do without in it. See `Docs/View Toolbar Contract`.
   */
  info?: ReactNode;
  /** Left cluster — status/context, `ViewToolbarFilters`, `ResultCount`. */
  children?: ReactNode;
  /** Right cluster — the view's actions. Stays reachable at every width. */
  actions?: ReactNode;
}

export const ViewToolbar = forwardRef<HTMLDivElement, ViewToolbarProps>(function ViewToolbar(
  { info, children, actions, className, ...props },
  ref,
) {
  const { t } = useLocale();

  return (
    <div
      ref={ref}
      data-slot="view-toolbar"
      className={cn("flex min-h-9 w-full flex-wrap items-center gap-x-3 gap-y-2", className)}
      {...props}
    >
      {info ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                data-slot="view-toolbar-info"
                aria-label={t("ui.viewToolbar.about")}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Info aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-pretty">{info}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}

      {/*
       * Always rendered, even when empty: it owns the free space (`flex-1`), so
       * the actions cluster stays anchored to the row's end, and it is a stable
       * `data-slot` seam for consumers/tests.
       *
       * `basis-64` when it HAS content is what makes the narrow-width degrade
       * work: with a 0 basis the left cluster would be squeezed to a few pixels
       * so the actions could stay on line 1, shredding the chips. With a 16rem
       * basis the two clusters stack instead. An EMPTY cluster keeps the 0 basis
       * so it never forces a pointless wrap.
       */}
      <div
        data-slot="view-toolbar-content"
        className={cn(
          "flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2",
          children ? "basis-64" : "basis-0",
        )}
      >
        {children}
      </div>

      {actions ? (
        <div
          data-slot="view-toolbar-actions"
          className="ms-auto flex min-w-0 flex-wrap items-center justify-end gap-2"
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
});

// ---------------------------------------------------------------------------
// ViewToolbarFilters (the active-filter region)
// ---------------------------------------------------------------------------

export interface ViewToolbarFiltersProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Clear every active filter. Supplying it renders the "clear all" affordance
   * at the end of the chip run; omit it when a view has no bulk reset.
   */
  onClearAll?: () => void;
}

/**
 * The chip run. Render it ONLY when at least one filter is active — the
 * "no filters applied" state is the region's ABSENCE, not an empty box.
 *
 * Runs at chip height (24px) so the whole group reads as one control rung; the
 * `actions` cluster runs at button height. That split is the fix for the
 * control-height scatter #331 measured.
 */
export const ViewToolbarFilters = forwardRef<HTMLDivElement, ViewToolbarFiltersProps>(
  function ViewToolbarFilters({ onClearAll, children, className, ...props }, ref) {
    const { t } = useLocale();

    return (
      <div
        ref={ref}
        data-slot="view-toolbar-filters"
        role="group"
        aria-label={t("ui.viewToolbar.activeFilters")}
        className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}
        {...props}
      >
        {children}
        {onClearAll ? (
          <Button
            variant="ghost"
            size="sm"
            data-slot="view-toolbar-clear-all"
            className="h-6 px-2"
            onClick={onClearAll}
          >
            {t("ui.viewToolbar.clearAll")}
          </Button>
        ) : null}
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// FilterChip
// ---------------------------------------------------------------------------

export interface FilterChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /**
   * Label-in-value text — `"Status: Failed"`, never `"Status = failed"` and
   * never a bare `"Failed"`. The caller composes the string so the chip reads
   * as a sentence fragment out of context (and in a screen reader).
   */
  label: string;
  /** Remove this filter. The WHOLE chip is the remove control — see below. */
  onRemove: () => void;
}

/**
 * A removable active-filter chip.
 *
 * The whole chip is a single `<button>` whose action is "remove", rather than a
 * span with a nested ✕: one tab stop instead of two, a ≥24px target (WCAG 2.5.8)
 * with no dead zone, and Enter/Space for free from the native element. Its
 * accessible name is "Remove filter: <label>", which CONTAINS the visible label
 * (WCAG 2.5.3 Label in Name).
 *
 * A chip that must EDIT a filter rather than remove it is a different control —
 * reach for `FacetFilter` (`@qlik-coe-emea/qlabs-components-data`), not a variant of this.
 */
export const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(function FilterChip(
  { label, onRemove, className, onClick, ...props },
  ref,
) {
  const { t } = useLocale();

  return (
    <button
      ref={ref}
      type="button"
      data-slot="view-toolbar-filter-chip"
      aria-label={t("ui.viewToolbar.removeFilter", { label })}
      className={cn(
        badgeVariants({ variant: "secondary" }),
        "group min-h-6 max-w-full gap-1 ps-2.5 pe-1.5",
        "transition-colors duration-fast ease-standard hover:bg-secondary/70",
        // Badge's own `focus:` ring is dead weight on a <span> but would fire on
        // every MOUSE click here; neutralise it and keep the focus-visible ring.
        "focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onRemove();
      }}
      {...props}
    >
      <span className="truncate">{label}</span>
      <X
        aria-hidden="true"
        className="size-3 shrink-0 opacity-60 transition-opacity duration-fast ease-standard group-hover:opacity-100"
      />
    </button>
  );
});

// ---------------------------------------------------------------------------
// ResultCount
// ---------------------------------------------------------------------------

export interface ResultCountProps extends HTMLAttributes<HTMLSpanElement> {
  /** How many rows/cards the view is showing right now. */
  count: number;
  /**
   * The unfiltered total. Supplying it renders "N of M" — the honest reading
   * when a filter is active. Omit it for an unfiltered view's bare count.
   */
  total?: number;
  /**
   * No count yet. Renders a layout-shaped placeholder instead of a `0` that
   * lies while the data is in flight (see `.claude/rules/loading-states.md`).
   */
  loading?: boolean;
  /**
   * Optional trailing noun ("results", "runs", "rows") joined with a
   * non-breaking space, so the number is never announced bare.
   */
  children?: ReactNode;
}

export const ResultCount = forwardRef<HTMLSpanElement, ResultCountProps>(function ResultCount(
  { count, total, loading = false, children, className, ...props },
  ref,
) {
  const { t, formatNumber } = useLocale();

  if (loading) {
    return (
      <span
        ref={ref}
        data-slot="view-toolbar-result-count"
        role="status"
        className={cn("inline-flex items-center", className)}
        {...props}
      >
        <span className="sr-only">{t("loading")}</span>
        <Skeleton className="h-3 w-16" />
      </span>
    );
  }

  const text =
    total === undefined
      ? formatNumber(count)
      : t("ui.viewToolbar.countOfTotal", {
          count: formatNumber(count),
          total: formatNumber(total),
        });

  return (
    <span
      ref={ref}
      data-slot="view-toolbar-result-count"
      className={cn("text-caption tabular-nums text-muted-foreground", className)}
      {...props}
    >
      {text}
      {children ? <>&nbsp;{children}</> : null}
    </span>
  );
});
