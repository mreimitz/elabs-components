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
 * that work; this wrapper reuses it and passes `count`/`countLabel` through
 * the base component's `trailing` slot (#284) — a second, non-shrinking text
 * element, distinct from the truncatable `label` — so the count reaches the
 * chip's ACCESSIBLE NAME (screen readers hear "Remove filter: Status: Failed
 * · excluded 1,204") AND survives truncation in the visible chip, instead of
 * being folded into the one string CSS `truncate` can clip from the tail.
 */
import { forwardRef } from "react";
import {
  FilterChip as BaseFilterChip,
  type FilterChipProps as BaseFilterChipProps,
  useLocale,
} from "@elabs-ai/components-ui";

// `trailing` is omitted alongside `label`: this wrapper derives its OWN
// `trailing` from `count`/`countLabel`. The `Omit` blocks `trailing` written
// as an object LITERAL, but TypeScript's excess-property check does not
// apply to a spread of an already-declared variable — `const extra = {
// trailing: "x" }; <FilterChip {...extra} />` still type-checks, and the
// value would land in `props` regardless of JSX attribute order (PR #408
// review round 2). So the `Omit` is necessary but not sufficient: below,
// `trailing` is also stripped from `props` at RUNTIME before it reaches the
// base component, so a caller-supplied `trailing` — literal or
// spread-smuggled — can never win at render, the same advertised-but-inert
// failure mode #382/#284-round-1 already closed elsewhere in the repo
// (`ContextRail`'s `children` omission).
export interface FilterChipProps extends Omit<BaseFilterChipProps, "label" | "trailing"> {
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

  // Runtime guard (belt and braces alongside the `Omit` above): a caller can
  // still smuggle `trailing` into `props` through a spread of an
  // already-declared variable, which the type system cannot catch. Strip it
  // here so the derived count wins regardless of prop order.
  const { trailing: _ignoredTrailing, ...restProps } = props as Omit<BaseFilterChipProps, "label">;

  return (
    <BaseFilterChip
      ref={ref}
      data-slot="filter-chip"
      label={label}
      {...restProps}
      trailing={countText}
    />
  );
});
