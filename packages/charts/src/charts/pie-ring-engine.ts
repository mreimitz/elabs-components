/**
 * The pieces `PieChart` and `RingChart` share: one `@visx/shape` arc-path
 * generator, and one "is this child a specific named mark/center component"
 * predicate. Pure, framework-free beyond `react`'s `ReactNode`/
 * `isValidElement` types — no context, no component.
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
 * Is `child` a React element whose component is named `name` — checking
 * both `displayName` and `name` off whatever `child.type` is, a plain
 * function (`PieCenter`, `RingCenter`) or a `memo()`/`forwardRef()` object
 * (`PieSlice`, `Ring`)? Either field matching is enough, so a component
 * exported under a different `displayName` than its function `name` (or
 * vice versa) still matches. `false` for a string child, a fragment, text
 * or `null`.
 */
export function isNamedChartChild(child: ReactNode, name: string): boolean {
  if (!isValidElement(child)) {
    return false;
  }
  const type = child.type as { displayName?: string; name?: string } | string;
  if (typeof type === "string") {
    return false;
  }
  return type.displayName === name || type.name === name;
}
