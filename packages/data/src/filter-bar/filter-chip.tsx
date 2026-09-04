"use client";

/**
 * filter-chip.tsx — `@elabs-ai/components-data`'s removable filter chip, with an optional
 * secondary count ("excluded 1,204") for `ProcessFilterBar` (RM-056, #221).
 *
 * Deliberately a thin COMPOSING wrapper around `@elabs-ai/components-ui`'s `FilterChip`
 * (`view-toolbar.tsx`, #331) rather than a second implementation — the dedupe
 * audit found the real, accessible, whole-chip-as-button `FilterChip` already
 * lives there (WCAG 2.5.8 target size, WCAG 2.5.3 "Remove filter: <label>"
 * accessible name). Building a second one in `packages/data` would duplicate
 * that work; this wrapper reuses it and folds `count`/`countLabel` into the
 * LABEL TEXT the base component both renders and names itself from — so the
 * count reaches the chip's ACCESSIBLE NAME automatically (screen readers hear
 * "Remove filter: Status: Failed · excluded 1,204"), not only its visible
 * text.
 */
import { forwardRef } from "react";
import {
  FilterChip as BaseFilterChip,
  type FilterChipProps as BaseFilterChipProps,
  useLocale,
} from "@elabs-ai/components-ui";

export interface FilterChipProps extends Omit<BaseFilterChipProps, "label"> {
  /**
   * Label-in-value text — `"Status: Failed"`, never `"Status = failed"` and
   * never a bare `"Failed"`. Same contract as the base `FilterChip`.
   */
  label: string;
  /**
   * How many records this active filter excluded (or matched) — rendered as a
   * secondary, locale-formatted segment alongside `label`. Omit for a bare
   * chip with no count.
   */
  count?: number;
  /**
   * The word placed before the formatted count, e.g. `"excluded"` →
   * `"excluded 1,204"`. Omitted by default: a bare `count` renders as just the
   * formatted number.
   */
  countLabel?: string;
}

/**
 * A removable active-filter chip with an optional secondary count.
 *
 * `onRemove` stays REQUIRED (inherited from the base `FilterChip`, diverging
 * from this item's spec draft) — the whole chip IS the remove control, so a
 * chip with no removal affordance is a plain `Badge`, not this component.
 */
export const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(function FilterChip(
  { label, count, countLabel, ...props },
  ref,
) {
  const { formatNumber } = useLocale();
  const countText =
    count === undefined
      ? undefined
      : countLabel
        ? `${countLabel} ${formatNumber(count)}`
        : formatNumber(count);

  return (
    <BaseFilterChip
      ref={ref}
      data-slot="filter-chip"
      label={countText ? `${label} · ${countText}` : label}
      {...props}
    />
  );
});
