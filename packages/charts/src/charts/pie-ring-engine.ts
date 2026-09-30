/**
 * The pieces `PieChart` and `RingChart` share: one `@visx/shape` arc-path
 * generator. Pure, framework-free beyond `@visx/shape` — no context, no
 * component.
 */
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

/** The one "is this child a specific named mark/center component" predicate (`chart-defs.ts`). */
export { isNamedChartChild } from "./chart-defs";
