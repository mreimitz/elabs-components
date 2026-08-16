"use client";

import { forwardRef, useCallback, useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { NumberInput } from "../number-input";
import { Slider } from "../slider";
import { useLocale } from "../locale-provider";

export interface SliderNumberProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  /** Controlled value. Pass `null` for "use the provider default". */
  value?: number | null;
  /** Uncontrolled initial value. */
  defaultValue?: number | null;
  /** Called when the value changes — always rounded identically on the drag and type paths. */
  onValueChange?: (value: number | null) => void;
  /** Minimum allowed value. Defaults to 0. */
  min?: number;
  /** Maximum allowed value. Defaults to 100. */
  max?: number;
  /** Step increment for both the slider and the number input's arrow keys. Defaults to 1. */
  step?: number;
  /**
   * Number of decimal places to round to. Defaults to the decimal places in
   * `step` (e.g. `step={0.1}` rounds to 1 decimal). Applied identically on
   * BOTH the slider path and the number-input path so drag-then-type never
   * disagrees.
   */
  precision?: number;
  /** Label for the reset-to-provider-default control. Defaults to "Reset". */
  resetLabel?: ReactNode;
  /** Disables the whole control. */
  disabled?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

function getStepDecimals(step: number): number {
  const str = step.toString();
  const dot = str.indexOf(".");
  return dot === -1 ? 0 : str.length - dot - 1;
}

function clampValue(value: number, min?: number, max?: number): number {
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

/** Rounds to a fixed decimal precision — the ONE function both paths call. */
function roundValue(value: number, step: number, precision?: number): number {
  const decimals = precision ?? getStepDecimals(step);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * SliderNumber — a `Slider` and a `NumberInput` bound to one value, clamped
 * and rounded in lockstep so they can never disagree, plus an explicit
 * `null` state meaning "use the provider default" with a reset control.
 *
 * The subtle part (#372): both the slider's `onValueChange` and the number
 * input's `onValueChange` are routed through the SAME `commit` function,
 * which rounds to a fixed decimal precision before storing — so dragging to
 * a value and then typing the same value never produces two representations
 * of the same intent (e.g. floating-point drift like `0.30000000000000004`).
 */
export const SliderNumber = forwardRef<HTMLDivElement, SliderNumberProps>(function SliderNumber(
  {
    value: valueProp,
    defaultValue,
    onValueChange,
    min = 0,
    max = 100,
    step = 1,
    precision,
    resetLabel,
    disabled,
    id,
    name,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    className,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  const isControlled = valueProp !== undefined;
  const [internalValue, setInternalValue] = useState<number | null>(
    defaultValue !== undefined ? defaultValue : null,
  );
  const currentValue = isControlled ? valueProp : internalValue;

  // Bumped whenever this component normalises a typed value back to the value
  // it ALREADY holds. `NumberInput` only re-derives its display text when the
  // controlled `value` prop CHANGES, so in that one case it would keep showing
  // the raw keystrokes ("0.44") while the slider and the committed value read
  // the rounded one (0.4) — the exact "slider and input disagree" failure this
  // component exists to prevent. Remounting it re-derives the text from the
  // value that was actually accepted. It only ever fires on blur, when the
  // input is no longer focused, so the remount is invisible.
  const [inputEpoch, setInputEpoch] = useState(0);

  const commit = useCallback(
    (next: number | null) => {
      const rounded = next == null ? null : roundValue(clampValue(next, min, max), step, precision);
      if (next != null && rounded !== next && rounded === currentValue) {
        setInputEpoch((n) => n + 1);
      }
      if (!isControlled) setInternalValue(rounded);
      onValueChange?.(rounded);
    },
    [isControlled, onValueChange, min, max, step, precision, currentValue],
  );

  const isDefault = currentValue == null;
  const sliderValue = currentValue ?? min;

  return (
    <div
      ref={ref}
      data-slot="slider-number"
      // A default FIXED width (matching Slider's own convention — it has no
      // intrinsic width either, and its stories always pass one via
      // className) so the Slider's `flex-1` has real space to grow into.
      // `w-full`/percentage widths are unresolvable inside an ancestor with
      // no definite width (e.g. Storybook's default "centered" layout, or a
      // bare inline/flex context), which collapses `flex-1` to near-zero.
      // Callers in a definite-width layout can still override via `className`
      // (e.g. `className="w-full"` inside a form field's own fixed-width row).
      // `max-w-full` keeps the fixed width from OVERFLOWING a container
      // narrower than 20rem (a settings drawer, a 320px mobile column) — it is
      // a preferred width, not a floor.
      className={cn("flex w-80 max-w-full items-center gap-3", className)}
      {...props}
    >
      <Slider
        data-slot="slider-number-slider"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={[sliderValue]}
        onValueChange={(values) => commit(values[0] ?? null)}
        thumbProps={{
          // Visually distinct "provider default" thumb — dimmed + dashed,
          // never confusable with a real value (including 0).
          className: cn(isDefault && "opacity-50 border-dashed"),
        }}
        className="flex-1"
      />
      <NumberInput
        key={inputEpoch}
        data-slot="slider-number-input"
        id={id}
        name={name}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={currentValue}
        onValueChange={commit}
        // NumberInput's own default is w-36 (144px); shrinking it below
        // ~w-32 leaves too little room for the digits once its own
        // decrease/increase buttons are subtracted, clipping the text.
        className="w-32 shrink-0"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-slot="slider-number-reset"
        disabled={disabled || isDefault}
        onClick={() => commit(null)}
      >
        {resetLabel ?? t("ui.sliderNumber.reset")}
      </Button>
    </div>
  );
});
