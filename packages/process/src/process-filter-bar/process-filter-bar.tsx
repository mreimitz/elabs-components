"use client";

/**
 * ProcessFilterBar — filter chain breadcrumbs with excluded-count chips (RM-056, #205).
 *
 * §4 R13 of the process-mining components analysis requires "filter breadcrumbs showing
 * the active filter chain, removable, with 'excluded' counts" for every persona — the 2026
 * literature review's first systematic gap is "no visible reference to what was filtered
 * out", and this component is that visible reference. It composes `@elabs-ai/components-data`'s
 * `FilterBar`/`FilterChip` — the chip's own `count`/`countLabel`/`onRemove` contract already
 * carries the "excluded N" reading (RM-047) — and authors no chip markup of its own
 * (`pnpm check --rule process-reuse`).
 *
 * ## Index keys, not intent ids
 *
 * `useProcessExplorer`'s `intents: FilterIntent[]` carries no id field — `clearIntent` and
 * this bar's own `onRemove` both key by ARRAY INDEX, matching the hook's real contract
 * (`.claude/scratch/process-mining/wave-2/common-brief.md`). `excludedByIntent` is the
 * hook's own additive field (same file, this item's other touch): index `i` there is the
 * case count intent `i` ALONE excludes from the chain, parallel to `intents[i]`.
 *
 * ## The summary line never double-counts
 *
 * `filteredCases`/`totalCases` describe what FILTERING removed; `hiddenCounts.activities`
 * (from `AbstractionControls`, RM-052) describes what ABSTRACTION additionally hides from
 * the picture. The two are disjoint by construction (`useProcessExplorer`'s own module
 * docblock, Invariant F) — this component states them as two independently-omittable
 * clauses of one sentence rather than merging them into one number, the same "two
 * independently-pluralized fragments, composed at the call site" shape `AbstractionControls`
 * already uses for its own hidden-count line.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { Button, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { FilterBar, FilterChip } from "@elabs-ai/components-data";
import type { FilterIntent } from "../use-process-explorer";

/** One intent, worded as a chip label — label-in-value text, never a bare activity name. */
function intentChipLabel(t: ReturnType<typeof useLocale>["t"], intent: FilterIntent): string {
  switch (intent.kind) {
    case "with":
      return t("process.filterBar.with", { activity: intent.activity });
    case "without":
      return t("process.filterBar.without", { activity: intent.activity });
    case "startsWith":
      return t("process.filterBar.startsWith", { activity: intent.activity });
    case "endsWith":
      return t("process.filterBar.endsWith", { activity: intent.activity });
    case "variant":
      return t("process.filterBar.variant", { count: intent.ids.length });
    case "cases":
      return t("process.filterBar.cases", { count: intent.ids.length });
    default:
      return t("process.filterBar.filter");
  }
}

export interface ProcessFilterBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The active filter chain — `useProcessExplorer`'s own `intents`, in order. */
  intents: FilterIntent[];
  /**
   * How many cases EACH intent alone excludes, parallel to {@link intents} (same index) —
   * `useProcessExplorer`'s own additive `excludedByIntent` field.
   */
  excludedByIntent: number[];
  /** The unfiltered case count — the right half of the summary line's "X of Y". */
  totalCases: number;
  /** `useProcessExplorer`'s `kpis.cases` — the left half of the summary line's "X of Y". */
  filteredCases: number;
  /** What abstraction currently hides — `useProcessExplorer`'s own `hiddenCounts`. */
  hiddenCounts?: { activities: number; paths: number };
  /** Remove one intent by its index into {@link intents} — wire to `clearIntent`. */
  onRemove(index: number): void;
  /** Remove every intent at once. */
  onClearAll(): void;
  /** Accessible name for the chip row. Default from locale. */
  label?: string;
}

/**
 * Filter chain breadcrumbs: one removable chip per active intent, each carrying how many
 * cases that intent alone excludes, plus a summary line stating what filtering and
 * abstraction currently hide.
 */
export const ProcessFilterBar = forwardRef<HTMLDivElement, ProcessFilterBarProps>(
  function ProcessFilterBar(
    {
      intents,
      excludedByIntent,
      totalCases,
      filteredCases,
      hiddenCounts,
      onRemove,
      onClearAll,
      label,
      className,
      ...props
    },
    ref,
  ) {
    const { t, formatNumber } = useLocale();

    const hasIntents = intents.length > 0;
    const hasHiddenByAbstraction = (hiddenCounts?.activities ?? 0) > 0;

    // Two independently-omittable clauses, joined — mirrors `AbstractionControls`' own
    // hidden-count line (see the module docblock): "what filtering removed" and "what
    // abstraction additionally hides" are disjoint numbers, never merged into one.
    const casesClause =
      filteredCases === totalCases
        ? t("process.filterBar.showingAll", {
            count: totalCases,
            total: formatNumber(totalCases),
          })
        : t("process.filterBar.showing", {
            filtered: formatNumber(filteredCases),
            total: formatNumber(totalCases),
          });
    const summary = hasHiddenByAbstraction
      ? `${casesClause} · ${t("process.filterBar.hiddenByAbstraction", {
          count: hiddenCounts!.activities,
        })}`
      : casesClause;

    return (
      <div
        ref={ref}
        data-slot="process-filter-bar"
        className={cn("flex flex-col gap-2", className)}
        {...props}
      >
        {hasIntents ? (
          // `FilterBar` (data package) has no `role`/`aria-label` of its own to forward —
          // this wrapping `div` is the group's real accessible-name carrier.
          <div role="group" aria-label={label ?? t("process.filterBar.label")}>
            <FilterBar
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-slot="process-filter-bar-clear-all"
                  onClick={onClearAll}
                >
                  {t("process.filterBar.clearAll")}
                </Button>
              }
            >
              {intents.map((intent, index) => (
                <FilterChip
                  key={`${intent.kind}-${index}`}
                  label={intentChipLabel(t, intent)}
                  count={excludedByIntent[index] ?? 0}
                  countLabel={t("process.filterBar.excludedLabel")}
                  onRemove={() => onRemove(index)}
                />
              ))}
            </FilterBar>
          </div>
        ) : null}
        <p data-slot="process-filter-bar-summary" className="text-meta text-muted-foreground">
          {summary}
        </p>
      </div>
    );
  },
);
