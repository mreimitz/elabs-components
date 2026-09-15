import { useCallback, useState } from "react";

/**
 * Shared controlled/uncontrolled state primitive.
 *
 * `isControlled` is fixed by whether `controlledValue` is `undefined` on the
 * FIRST render (the usual React contract — don't flip modes across renders).
 * The setter always does BOTH of its jobs, unconditionally:
 * - uncontrolled: updates the internal state (so the next render reflects it)
 * - always: calls `onChange`, so a listener attached to an otherwise
 *   uncontrolled component still observes every change.
 *
 * A hand-rolled `value ?? internal` + `onChange ? onChange(v) : setInternal(v)`
 * ternary gets this wrong in two ways: an uncontrolled component with an
 * `onChange` handler stops updating its own displayed value (the ternary
 * only ever takes one branch), and clearing a controlled value to `undefined`
 * falls through to a stale `internal` instead of showing "no value" — see
 * Combobox/DatePicker (#reviewed 1.7).
 */
export function useControllableState<T>(
  controlledValue: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void,
): [T, (next: T) => void] {
  const isControlled = controlledValue !== undefined;
  const [internal, setInternal] = useState<T>(defaultValue);
  const value = isControlled ? controlledValue : internal;

  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  return [value, setValue];
}
