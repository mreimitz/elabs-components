// a2ui.exposed: yes
import { forwardRef, useCallback, useRef, useState, type HTMLAttributes } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "../../lib/cn";
import { InputGroup, InputGroupButton, InputGroupInput } from "../input-group";
import { useLocale } from "../locale-provider";

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

/** Number of decimal places implied by a step (e.g. 0.1 → 1, 1 → 0). */
function stepDecimals(step: number): number {
  if (!isFinite(step) || step === 0) return 0;
  const s = String(step);
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

/** Round `value` to the decimal precision implied by `step`, avoiding fp noise (0.1+0.2). */
function roundToStep(value: number, step: number): number {
  const decimals = stepDecimals(step);
  if (decimals === 0) return Math.round(value);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** The active locale's decimal and group separator characters (e.g. "," / "." in de-DE). */
function getLocaleSeparators(locale: string): { decimal: string; group: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
  const group = parts.find((p) => p.type === "group")?.value ?? ",";
  return { decimal, group };
}

/** Parse a locale-formatted numeric string (group + decimal separators) into a number. */
function parseLocaleNumber(raw: string, locale: string): number {
  const { decimal, group } = getLocaleSeparators(locale);
  let normalized = raw.trim();
  if (group) normalized = normalized.split(group).join("");
  if (decimal !== ".") normalized = normalized.split(decimal).join(".");
  return Number(normalized);
}

/**
 * NumberInput — a numeric stepper that composes InputGroup + two step buttons.
 *
 * Controlled via `value`/`onValueChange`; uncontrolled via `defaultValue`.
 * Keyboard ↑/↓ = ±step; Shift+↑/↓ = ±step×10. Clamps on blur (not per keystroke).
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
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
  const { locale, formatNumber } = useLocale();
  const isControlled = valueProp !== undefined;

  const formatValue = useCallback(
    (n: number) => formatNumber(n, formatOptions),
    [formatNumber, formatOptions],
  );

  const [internalValue, setInternalValue] = useState<number | null>(
    defaultValue !== undefined ? defaultValue : null,
  );
  const [inputText, setInputText] = useState<string>(() => {
    const initial = isControlled ? valueProp : defaultValue;
    return initial != null ? formatValue(initial) : "";
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
      let next = roundToStep(base + delta, step);
      if (clamp) next = clampValue(next, min, max);
      setInputText(formatValue(next));
      commit(next);
    },
    [disabled, readOnly, currentValue, step, clamp, min, max, formatValue, commit],
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
    const parsed = parseLocaleNumber(raw, locale);
    if (isNaN(parsed)) {
      // Revert to last known good value
      setInputText(currentValue != null ? formatValue(currentValue) : "");
      return;
    }
    const rounded = roundToStep(parsed, step);
    const clamped = clamp ? clampValue(rounded, min, max) : rounded;
    setInputText(formatValue(clamped));
    commit(clamped);
  }, [inputText, currentValue, clamp, min, max, step, locale, formatValue, commit]);

  // Keep display text in sync with controlled value changes (only when not editing)
  const prevControlledValue = useRef(valueProp);
  if (isControlled && valueProp !== prevControlledValue.current && !isEditing.current) {
    prevControlledValue.current = valueProp;
    const nextText = valueProp != null ? formatValue(valueProp) : "";
    if (nextText !== inputText) setInputText(nextText);
  }

  const decrementDisabled =
    disabled || readOnly || (min !== undefined && (currentValue ?? 0) <= min);
  const incrementDisabled =
    disabled || readOnly || (max !== undefined && (currentValue ?? 0) >= max);

  return (
    <InputGroup className={className} {...props}>
      <InputGroupButton
        aria-label="Decrease"
        tabIndex={-1}
        disabled={decrementDisabled}
        onClick={() => applyStep(-step)}
        className="rounded-e-none"
      >
        <Minus aria-hidden="true" />
      </InputGroupButton>
      <InputGroupInput
        ref={ref}
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-valuenow={currentValue ?? undefined}
        aria-valuemin={min}
        aria-valuemax={max}
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
        className="text-center"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      <InputGroupButton
        aria-label="Increase"
        tabIndex={-1}
        disabled={incrementDisabled}
        onClick={() => applyStep(step)}
        className="rounded-s-none"
      >
        <Plus aria-hidden="true" />
      </InputGroupButton>
    </InputGroup>
  );
});
