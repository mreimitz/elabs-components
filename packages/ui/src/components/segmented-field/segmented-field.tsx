"use client";

import {
  forwardRef,
  useCallback,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";
import { Label } from "../label";
import { ToggleGroup, ToggleGroupItem } from "../toggle-group";

/** Keys whose focus move must also move the selection (WAI-ARIA radiogroup). */
const NAV_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

export interface SegmentedFieldOption {
  /** The option's value, reported to `onValueChange`. */
  value: string;
  /** Visible content for the segment. */
  label: ReactNode;
  /** Disables just this segment. */
  disabled?: boolean;
}

export interface SegmentedFieldProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  /** Visible label describing the field. */
  label: ReactNode;
  /**
   * Segment options. Omit and render `ToggleGroupItem` children directly for
   * the compound-component escape hatch (component-api.md) when a plain
   * `{ value, label }` shape isn't expressive enough.
   */
  options?: SegmentedFieldOption[];
  /** Controlled selected value. */
  value?: string;
  /** Uncontrolled initial selected value. */
  defaultValue?: string;
  /**
   * Called when the selected value changes. Never called with `""` —
   * re-clicking the active segment (Radix `ToggleGroup`'s `type="single"`
   * empty-emission on re-click) is swallowed as a no-op instead of clearing
   * the field.
   */
  onValueChange?: (value: string) => void;
  /** Size applied to every segment. Defaults to "sm", matching the compact segmented look. */
  size?: "default" | "sm" | "lg";
  /** Disables every segment. */
  disabled?: boolean;
  /** `ToggleGroupItem` children — the compound escape hatch (used instead of `options`). */
  children?: ReactNode;
}

/**
 * SegmentedField — a labelled segmented control with STICKY selection.
 *
 * Composes the existing `Label` + `ToggleGroup`/`ToggleGroupItem`
 * (`variant="segmented"`) — no new visual style. The whole reason this
 * component exists: Radix's `ToggleGroup` in `type="single"` mode emits `""`
 * when the already-active segment is re-clicked, silently clearing a field
 * that must always hold exactly one value. `SegmentedField` swallows that
 * emission so re-clicking the active segment is a true no-op.
 *
 * Per the WAI-ARIA radiogroup pattern (each segment renders `role="radio"`
 * for `type="single"`), ARROW-KEY navigation also SELECTS the newly focused
 * segment (selection follows focus), matching native radio-button behavior —
 * Radix's roving-tabindex only moves focus, so this component adds that
 * activation on top of it.
 *
 * Selection follows focus ONLY for arrow/Home/End keys, never for arbitrary
 * focus. A bare `onFocus` commit would make three non-navigation paths mutate
 * the field: clicking the `<Label>` (which moves focus into the group),
 * tabbing into a group with nothing selected yet, and any programmatic
 * `.focus()` a consumer performs. The keyboard intent is recorded on the
 * wrapper in the CAPTURE phase (it must land before Radix's own roving-focus
 * keydown handler runs) and is cleared by the focus it explains, by a pointer
 * press, by any non-navigation key, or by focus leaving the field — so it can
 * never leak into a later, unrelated focus.
 */
export const SegmentedField = forwardRef<HTMLDivElement, SegmentedFieldProps>(
  function SegmentedField(
    {
      label,
      options,
      value: valueProp,
      defaultValue,
      onValueChange,
      size = "sm",
      disabled,
      id,
      className,
      children,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const labelId = `${id ?? generatedId}-label`;
    const groupRef = useRef<HTMLDivElement>(null);

    const isControlled = valueProp !== undefined;
    const [internalValue, setInternalValue] = useState(defaultValue);
    const currentValue = isControlled ? valueProp : internalValue;

    // Synced every render (mirrors the ref-during-render idiom in
    // NumberInput) so a same-event double-dispatch (focus-follows-selection
    // AND the click's own onPressedChange) commits at most once.
    const lastCommittedRef = useRef(currentValue);
    lastCommittedRef.current = currentValue;

    const commit = useCallback(
      (next: string) => {
        // Radix emits "" when the active segment is re-clicked — swallow it.
        if (next === "" || next === lastCommittedRef.current) return;
        lastCommittedRef.current = next;
        if (!isControlled) setInternalValue(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    // Armed by an arrow/Home/End key, DISARMED by anything else — a pointer
    // press, any other key, or focus leaving the field. It is deliberately not
    // a timer: `@radix-ui/react-roving-focus` moves focus in a
    // `setTimeout(() => focusFirst(...))`, so a microtask/`setTimeout` reset
    // queued from the capture phase would always fire first and the arm would
    // be gone before the focus it exists to classify.
    const keyboardNavRef = useRef(false);

    const handleKeyDownCapture = useCallback(
      (event: ReactKeyboardEvent<HTMLDivElement>) => {
        keyboardNavRef.current = NAV_KEYS.has(event.key);
        props.onKeyDownCapture?.(event);
      },
      [props],
    );

    const handlePointerDownCapture = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        keyboardNavRef.current = false;
        props.onPointerDownCapture?.(event);
      },
      [props],
    );

    const handleBlurCapture = useCallback(
      (event: ReactFocusEvent<HTMLDivElement>) => {
        // Focus moving between segments keeps the arm; leaving the field drops
        // it, so a stale arm can never fire on a later tab-in.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          keyboardNavRef.current = false;
        }
        props.onBlurCapture?.(event);
      },
      [props],
    );

    const handleItemFocus = useCallback(
      (next: string) => {
        if (!keyboardNavRef.current) return;
        keyboardNavRef.current = false;
        commit(next);
      },
      [commit],
    );

    // Match a native `<label>`: move focus into the field without changing it.
    // Focusing the SELECTED segment (not blindly the first) keeps the visible
    // selection and the focus ring in agreement.
    const handleLabelClick = useCallback(() => {
      const group = groupRef.current;
      if (!group) return;
      const selected = group.querySelector<HTMLButtonElement>(
        '[aria-checked="true"]:not(:disabled),[data-state="on"]:not(:disabled)',
      );
      (selected ?? group.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus();
    }, []);

    return (
      <div
        ref={ref}
        data-slot="segmented-field"
        className={cn("flex flex-col items-start gap-1.5", className)}
        {...props}
        // After the spread: these three are load-bearing (they classify a
        // focus as arrow-navigation or not) and each re-invokes the consumer's
        // handler, so composing beats being silently replaced.
        onKeyDownCapture={handleKeyDownCapture}
        onPointerDownCapture={handlePointerDownCapture}
        onBlurCapture={handleBlurCapture}
      >
        <Label id={labelId} data-slot="segmented-field-label" onClick={handleLabelClick}>
          {label}
        </Label>
        <ToggleGroup
          ref={groupRef}
          type="single"
          variant="segmented"
          size={size}
          // Always a string, never `undefined` — an unselected field would
          // otherwise start UNcontrolled and flip to controlled on the first
          // selection (React/Radix warn, and the mode flip is exactly what
          // component-api.md forbids). `""` is Radix's "nothing selected".
          value={currentValue ?? ""}
          onValueChange={commit}
          disabled={disabled}
          aria-labelledby={labelId}
          data-slot="segmented-field-options"
        >
          {options
            ? options.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  data-slot="segmented-field-segment"
                  value={option.value}
                  disabled={option.disabled}
                  onFocus={() => handleItemFocus(option.value)}
                >
                  {option.label}
                </ToggleGroupItem>
              ))
            : children}
        </ToggleGroup>
      </div>
    );
  },
);
