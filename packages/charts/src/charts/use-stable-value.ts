import { useRef } from "react";

/**
 * Returns a referentially-STABLE value as long as its content is unchanged,
 * even when the caller passes a freshly-allocated object/array every render.
 *
 * Chart containers (`BarChart`, `AreaChart`, `LineChart`, `ComposedChart`,
 * `ScatterChart`, `LiveLineChart`, …) derive a small config array (series,
 * axis settings, …) from their JSX `children` via `useMemo(() => extractX
 * (children), [children])`. `children` gets a brand-new element/array
 * identity from React on every parent render — even when nothing the parent
 * passed actually changed — so that `useMemo` recomputes AND hands back a
 * new reference every time. Anything downstream that itself memoizes on
 * THAT reference (e.g. `ChartProvider`'s `contextValue`) then also
 * recomputes, rebuilding scales on every unrelated parent re-render.
 *
 * `useStableValue` compares the new value against the previous one by
 * content (`JSON.stringify`) and, when equal, returns the PREVIOUS
 * reference instead — so a `useMemo` keyed on this hook's output only
 * invalidates when the series actually changed.
 *
 * Only safe for plain, JSON-serializable data (the `{dataKey, stroke, ...}`
 * -shaped config objects the `extract*` helpers return) — never for a value
 * containing React elements, functions, or other non-serializable content.
 */
export function useStableValue<T>(value: T): T {
  const ref = useRef<{ value: T; signature: string }>(undefined);
  const signature = JSON.stringify(value);
  if (!ref.current || ref.current.signature !== signature) {
    ref.current = { value, signature };
  }
  return ref.current.value;
}
