/**
 * DG-14 — the seam wave-3 items use to add canvas behaviour without editing each other's
 * lines: each item's hook returns a slice of CanvasShell props, and `mergeCanvasProps`
 * combines the slices. Same-named handlers run in order; the last one's result is returned.
 * An `undefined` slice is a slot no item has filled yet (canvas-pane.tsx).
 */
import type { CanvasShellProps } from "@elabs-ai/components-flow";

export type CanvasProps = Partial<CanvasShellProps>;

export function mergeCanvasProps(...slices: readonly (CanvasProps | undefined)[]): CanvasProps {
  const merged: Record<string, unknown> = {};
  for (const slice of slices) {
    if (!slice) continue;
    for (const [key, value] of Object.entries(slice)) {
      const previous = merged[key];
      merged[key] =
        typeof previous === "function" && typeof value === "function"
          ? (...args: unknown[]) => {
              (previous as (...a: unknown[]) => unknown)(...args);
              return (value as (...a: unknown[]) => unknown)(...args);
            }
          : value;
    }
  }
  return merged as CanvasProps;
}
