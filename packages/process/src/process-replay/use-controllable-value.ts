"use client";

/**
 * Controlled/uncontrolled state with a STABLE setter (RM-065).
 *
 * Mirrors `useControllableState` in `@elabs-ai/components-ui` (mode locked on mount,
 * `onChange` always called), which that package does not export. The one difference is the
 * point of this copy: the setter's identity never changes, even when a consumer passes an
 * inline `onChange`, so the replay's animation-frame loop does not restart every frame.
 */
import { useCallback, useLayoutEffect, useRef, useState } from "react";

export function useControllableValue<T>(
  controlledValue: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void,
): [T, (next: T) => void] {
  const isControlledRef = useRef(controlledValue !== undefined);
  const [internal, setInternal] = useState<T>(defaultValue);
  const value = isControlledRef.current ? (controlledValue as T) : internal;
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });
  const setValue = useCallback((next: T) => {
    if (!isControlledRef.current) setInternal(next);
    onChangeRef.current?.(next);
  }, []);
  return [value, setValue];
}
