// a2ui.exposed: yes
import { forwardRef, useCallback, useRef, useState, type HTMLAttributes } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "../../lib/cn";
import { InputGroup, InputGroupButton, InputGroupInput } from "../input-group";

export interface NumberInputProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  /** Controlled value. Pass `null` to represent an empty state. */
  value?: number | null;
  /** Uncontrolled default value. */
  defaultValue?: number | null;
  /** Called when the numeric value changes. */
  onValueChange?: (value: number | null) => void;
  /** Minimum allowed value. */
  min?: number;
  /** Maximum allowed value. */
  max?: number;
  /** Step increment/decrement amount (default 1). */
  step?: number;
  /**
   * When true (default), the value is clamped to [min, max] on blur.
   * Clamping does NOT happen per-keystroke — only on blur.
   */
  clamp?: boolean;
  /** Intl.NumberFormat options used to format the displayed value. */
  formatOptions?: Intl.NumberFormatOptions;
  /** Placeholder text for the underlying input. */
  placeholder?: string;
  /** Whether the input is disabled. */
  disabled?: boolean;
  /** Whether the input is read-only. */
  readOnly?: boolean;
  /** Name attribute forwarded to the underlying <input>. */
  name?: string;
  /** id attribute forwarded to the underlying <input>. */
  id?: string;
  /** aria-label forwarded to the underlying <input>. */
  "aria-label"?: string;
  /** aria-labelledby forwarded to the underlying <input>. */
  "aria-labelledby"?: string;
  /** aria-describedby forwarded to the underlying <input>. */
  "aria-describedby"?: string;
  /** aria-invalid forwarded to the underlying <input>. */
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
  /** aria-required forwarded to the underlying <input>. */
  "aria-required"?: boolean | "true" | "false";
}

function clampValue(val: number, min?: number, max?: number): number {
  let result = val;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

function formatNum(value: number, formatOptions?: Intl.NumberFormatOptions): string {
  if (formatOptions) {
    return new Intl.NumberFormat(undefined, formatOptions).format(value);
  }
  return String(value);
}

/**
 * NumberInput — a numeric stepper that composes InputGroup + two step buttons.
 *
 * Controlled via `value`/`onValueChange`; uncontrolled via `defaultValue`.
 * Keyboard ↑/↓ = ±step; Shift+↑/↓ = ±step×10. Clamps on blur (not per keystroke).
 */
export const NumberInput = forwardRef<HTMLDivElement, NumberInputProps>(function NumberInput(
  {
    value: valueProp,
    defaultValue,
    onValueChange,
    min,
    max,
    step = 1,
    clamp = true,
    formatOptions,
    placeholder,
    disabled,
    readOnly,
    name,
    id,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    "aria-describedby": ariaDescribedby,
    "aria-invalid": ariaInvalid,
    "aria-required": ariaRequired,
    className,
    ...props
  },
  ref,
) {
  const isControlled = valueProp !== undefined;

  const [internalValue, setInternalValue] = useState<number | null>(
    defaultValue !== undefined ? defaultValue : null,
  );
  const [inputText, setInputText] = useState<string>(() => {
    const initial = isControlled ? valueProp : defaultValue;
    return initial != null ? formatNum(initial, formatOptions) : "";
  });
  // Track whether the user is actively editing to avoid overwriting their input
  const isEditing = useRef(false);

  const currentValue = isControlled ? valueProp : internalValue;

  const commit = useCallback(
    (next: number | null) => {
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const applyStep = useCallback(
    (delta: number) => {
      if (disabled || readOnly) return;
      const base = currentValue ?? 0;
      let next = base + delta;
      if (clamp) next = clampValue(next, min, max);
      setInputText(next != null ? formatNum(next, formatOptions) : "");
      commit(next);
    },
    [disabled, readOnly, currentValue, clamp, min, max, formatOptions, commit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const multiplier = e.shiftKey ? 10 : 1;
        const delta = e.key === "ArrowUp" ? step * multiplier : -step * multiplier;
        applyStep(delta);
      }
    },
    [applyStep, step],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    isEditing.current = true;
    setInputText(e.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    isEditing.current = false;
    const raw = inputText.trim();
    if (raw === "") {
      commit(null);
      return;
    }
    const parsed = parseFloat(raw);
    if (isNaN(parsed)) {
      // Revert to last known good value
      setInputText(currentValue != null ? formatNum(currentValue, formatOptions) : "");
      return;
    }
    const clamped = clamp ? clampValue(parsed, min, max) : parsed;
    setInputText(formatNum(clamped, formatOptions));
    commit(clamped);
  }, [inputText, currentValue, clamp, min, max, formatOptions, commit]);

  // Keep display text in sync with controlled value changes (only when not editing)
  const prevControlledValue = useRef(valueProp);
  if (isControlled && valueProp !== prevControlledValue.current && !isEditing.current) {
    prevControlledValue.current = valueProp;
    const nextText = valueProp != null ? formatNum(valueProp, formatOptions) : "";
    if (nextText !== inputText) setInputText(nextText);
  }

  const decrementDisabled =
    disabled || readOnly || (min !== undefined && (currentValue ?? 0) <= min);
  const incrementDisabled =
    disabled || readOnly || (max !== undefined && (currentValue ?? 0) >= max);

  return (
    <InputGroup ref={ref} className={cn("w-36", className)} {...props}>
      <InputGroupButton
        aria-label="Decrease"
        tabIndex={-1}
        disabled={decrementDisabled}
        onClick={() => applyStep(-step)}
        className="rounded-r-none"
      >
        <Minus aria-hidden="true" />
      </InputGroupButton>
      <InputGroupInput
        type="number"
        id={id}
        name={name}
        value={inputText}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
        aria-invalid={ariaInvalid}
        aria-required={ariaRequired}
        className="text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      <InputGroupButton
        aria-label="Increase"
        tabIndex={-1}
        disabled={incrementDisabled}
        onClick={() => applyStep(step)}
        className="rounded-l-none"
      >
        <Plus aria-hidden="true" />
      </InputGroupButton>
    </InputGroup>
  );
});
