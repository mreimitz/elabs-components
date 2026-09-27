/**
 * pie-ring-engine.ts — the pieces `PieChart` and `RingChart` shared as four
 * separate copies before RM-202 (review F28): one d3/@visx arc-path
 * generator (`pie-chart.tsx`, `pie-slice.tsx`, `ring-chart.tsx` and
 * `ring.tsx` each defined their own) and one "is this child a specific named
 * mark/center component" predicate (`isPieCenter`/`isPieSlice` on Pie,
 * `isRingCenter`/`isRing` on Ring). Pure, framework-free beyond `react`'s
 * `ReactNode`/`isValidElement` types — no context, no component.
 */
import { isValidElement, type ReactNode } from "react";
import { arc as arcGenerator } from "@visx/shape";

/**
 * One arc-path generator for both wedge (Pie) and ring (Ring) marks. `padAngle`
 * only Pie ever passes (a Ring arc never gaps against itself); Ring and its
 * children keep calling this with 5 args, unchanged behavior at `padAngle: 0`.
 */
export function generateArcPath(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  cornerRadius: number,
  padAngle = 0,
): string {
  const generator = arcGenerator<unknown>({
    innerRadius,
    outerRadius,
    cornerRadius,
    padAngle,
  });
  return generator({ startAngle, endAngle } as unknown as null) || "";
}

/**
 * Is `child` a React element whose component's `displayName`/`name` matches
 * `names`? Reads the name off whatever `child.type` is — a plain function
 * (`PieCenter`, `RingCenter`) or a `memo()` object (`PieSlice`, `Ring`) —
 * rather than gating on `typeof child.type === "function"` first, which
 * would silently never match a memo-wrapped mark (the bug class both
 * `isPieSlice` and `isRing` already worked around separately). `false` for a
 * string child, a fragment, text or `null`, same as every predicate this
 * replaces.
 */
export function isNamedChartChild(child: ReactNode, names: string | readonly string[]): boolean {
  if (!isValidElement(child)) {
    return false;
  }
  const type = child.type as { displayName?: string; name?: string } | string;
  if (typeof type === "string") {
    return false;
  }
  const childName = type.displayName || type.name || "";
  if (!childName) {
    return false;
  }
  return Array.isArray(names) ? names.includes(childName) : childName === names;
}
