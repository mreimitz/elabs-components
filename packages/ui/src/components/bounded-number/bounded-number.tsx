"use client";

import { forwardRef, useCallback, useState, type FocusEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { NumberInput, type NumberInputProps } from "../number-input";
import { useLocale } from "../locale-provider";

export interface BoundedNumberProps extends NumberInputProps {
  /**
   * Content shown in place of the value when the field is empty (`null`) and
   * not focused — e.g. "No limit" for a capped setting with no cap set.
   * Defaults to "No limit".
   */
  emptyLabel?: ReactNode;
}

/**
 * BoundedNumber — a `NumberInput` preset for a bounded numeric where "empty"
 * has a semantic meaning ("No limit") instead of reading as a blank box.
 *
 * Written reuse verdict (see #373): this wraps `NumberInput` rather than
 * reimplementing anything. `NumberInput` already does everything the value
 * needs — blur-only clamping (`clamp`, default true) and `null` as a real,
 * distinct empty state (`commit(null)` on empty blur). The only missing
 * behaviour is rendering that empty state as a meaningful label instead of a
 * blank input, which is exactly what this preset adds: an absolutely
 * positioned, `pointer-events-none` overlay shown only while the value is
 * `null` AND the field is not focused, so the underlying input stays fully
 * clickable/typable and still round-trips to `null` on an empty blur.
 */
export const BoundedNumber = forwardRef<HTMLDivElement, BoundedNumberProps>(function BoundedNumber(
  {
    value: valueProp,
    defaultValue,
    onValueChange,
    emptyLabel,
    onFocus,
    onBlur,
    className,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  const resolvedEmptyLabel = emptyLabel ?? t("ui.boundedNumber.emptyLabel");
  const isControlled = valueProp !== undefined;
  const [internalValue, setInternalValue] = useState<number | null>(
    defaultValue !== undefined ? defaultValue : null,
  );
  const [focused, setFocused] = useState(false);
  const currentValue = isControlled ? valueProp : internalValue;

  const handleValueChange = useCallback(
    (next: number | null) => {
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      setFocused(true);
      onFocus?.(event);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      setFocused(false);
      onBlur?.(event);
    },
    [onBlur],
  );

  const showEmptyLabel = currentValue == null && !focused;

  return (
    // `className` lands on the ROOT (the positioning context), not on the
    // inner `NumberInput`: a width utility on the inner control would resolve
    // against a shrink-to-fit wrapper and silently do nothing, so
    // `className="w-full"` could never widen the field. `w-36` here is
    // `NumberInput`'s own default width, re-declared so `cn()` lets the caller
    // override it; the input then simply fills the root.
    <div className={cn("relative inline-block w-36", className)} data-slot="bounded-number">
      <NumberInput
        ref={ref}
        value={currentValue}
        onValueChange={handleValueChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="w-full"
        {...props}
      />
      {showEmptyLabel && (
        <span
          aria-hidden="true"
          data-slot="bounded-number-empty-label"
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center",
            "text-body text-muted-foreground",
          )}
        >
          {resolvedEmptyLabel}
        </span>
      )}
    </div>
  );
});
