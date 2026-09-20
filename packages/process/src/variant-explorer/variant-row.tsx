"use client";

/**
 * One variant as a list row (RM-054): selection checkbox, rank, sequence chips and the
 * requested numeric columns.
 *
 * The checkbox is the row's ONE focus target. Its accessible name is the whole row in
 * words ("Variant 3, 6 activities, 214 cases, 12 percent coverage"), so a keyboard or
 * screen-reader user gets every number without a second tab stop per row. A pointer click
 * anywhere on the row toggles it too — the checkbox already offers the same action from the
 * keyboard, so the row click is a convenience, never the only path.
 */
import { forwardRef, type CSSProperties, type HTMLAttributes, type MouseEvent } from "react";
import { Checkbox } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { ActivityColorScale } from "../core/activity-color-scale";
import type { Variant } from "../core/types";
import type { ProcessSelectionState } from "../process-map/map-model";
import { VariantCoverageBar } from "./coverage-bar";
import { VariantSequenceChips } from "./sequence-chips";
import type { VariantExplorerColumn } from "./variant-explorer-model";

/** Pre-formatted text a row prints — the explorer formats once, with its locale. */
export interface VariantRowText {
  /** The checkbox's accessible name — the whole row in words. */
  summary: string;
  /** The sequence strip's accessible name. */
  sequence: string;
  cases: string;
  coverage: string;
  medianDuration: string;
}

export interface VariantRowProps extends Omit<HTMLAttributes<HTMLDivElement>, "onToggle"> {
  variant: Variant;
  /** 1-based position in the list. */
  rank: number;
  /** 0-based position in the list, stamped as `data-index` for the virtualizer. */
  index: number;
  selectionState: ProcessSelectionState;
  colorScale: ActivityColorScale;
  abbreviate: boolean;
  sequenceDisplay?: "text" | "swatch";
  columns: readonly VariantExplorerColumn[];
  text: VariantRowText;
  /** Whether this row's checkbox is the list's single tab stop. */
  tabbable: boolean;
  onToggle: (variantId: string) => void;
  onFocusRow: (index: number) => void;
  style?: CSSProperties;
}

export const VariantRow = forwardRef<HTMLDivElement, VariantRowProps>(function VariantRow(
  {
    variant,
    rank,
    index,
    selectionState,
    colorScale,
    abbreviate,
    sequenceDisplay,
    columns,
    text,
    tabbable,
    onToggle,
    onFocusRow,
    className,
    ...props
  },
  ref,
) {
  const selected = selectionState === "selected";

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    // The checkbox handles its own click; toggling here too would undo it.
    if ((event.target as HTMLElement).closest('[data-slot="checkbox"]')) return;
    onToggle(variant.id);
  };

  return (
    <div
      ref={ref}
      role="listitem"
      data-slot="variant-explorer-row"
      data-index={index}
      data-variant={variant.id}
      data-selection={selectionState}
      className={cn(
        "flex h-10 items-center gap-3 border-b border-border-strong px-3 transition-colors duration-fast ease-standard motion-reduce:transition-none",
        "hover:bg-muted/60 data-[selection=selected]:bg-accent data-[selection=excluded]:text-muted-foreground",
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      <Checkbox
        checked={selected}
        aria-label={text.summary}
        tabIndex={tabbable ? 0 : -1}
        onCheckedChange={() => onToggle(variant.id)}
        onFocus={() => onFocusRow(index)}
      />
      <span
        aria-hidden="true"
        className="w-8 shrink-0 text-meta text-muted-foreground tabular-nums"
      >
        {rank}
      </span>
      <VariantSequenceChips
        className="flex-1"
        sequence={variant.sequence}
        colorScale={colorScale}
        abbreviate={abbreviate}
        display={sequenceDisplay}
        label={text.sequence}
      />
      {columns.includes("cases") ? (
        <span aria-hidden="true" className="w-16 shrink-0 text-end text-meta tabular-nums">
          {text.cases}
        </span>
      ) : null}
      {columns.includes("coverage") ? (
        <VariantCoverageBar
          aria-hidden="true"
          className="w-32 shrink-0"
          share={variant.share}
          valueLabel={text.coverage}
        />
      ) : null}
      {columns.includes("medianDuration") ? (
        <span aria-hidden="true" className="w-20 shrink-0 text-end text-meta tabular-nums">
          {text.medianDuration}
        </span>
      ) : null}
    </div>
  );
});
