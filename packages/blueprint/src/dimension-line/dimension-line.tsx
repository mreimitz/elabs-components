import { forwardRef, type SVGProps } from "react";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";

export type DimensionEnds = "arrow" | "tick" | "dot";
export type DimensionOrientation = "horizontal" | "vertical";

export interface DimensionLineProps extends Omit<SVGProps<SVGSVGElement>, "orientation"> {
  /** The measurement text, e.g. "120 mm". Also the accessible name. */
  label: string;
  /** @default "horizontal" */
  orientation?: DimensionOrientation;
  /** Drawn span in px. @default 160 */
  length?: number;
  /** End-cap style. @default "arrow" */
  ends?: DimensionEnds;
}

const A = 5; // arrowhead size

function Cap({
  x,
  y,
  dir,
  ends,
}: {
  x: number;
  y: number;
  dir: "left" | "right" | "up" | "down";
  ends: DimensionEnds;
}) {
  if (ends === "dot") return <circle cx={x} cy={y} r={2} className="fill-rule stroke-none" />;
  if (ends === "tick") {
    return dir === "left" || dir === "right" ? (
      <line x1={x} y1={y - 4} x2={x} y2={y + 4} />
    ) : (
      <line x1={x - 4} y1={y} x2={x + 4} y2={y} />
    );
  }
  const pts =
    dir === "left"
      ? `${x},${y} ${x + A},${y - 3} ${x + A},${y + 3}`
      : dir === "right"
        ? `${x},${y} ${x - A},${y - 3} ${x - A},${y + 3}`
        : dir === "up"
          ? `${x},${y} ${x - 3},${y + A} ${x + 3},${y + A}`
          : `${x},${y} ${x - 3},${y - A} ${x + 3},${y - A}`;
  return <polygon points={pts} className="fill-rule stroke-none" />;
}

/**
 * Engineering dimension annotation: a measure line with tick / arrow / dot
 * end-caps and a centered measurement label. Conveys a measurement, so it is a
 * labelled image (role="img", aria-label={label}); the caps are decorative.
 */
export const DimensionLine = forwardRef<SVGSVGElement, DimensionLineProps>(function DimensionLine(
  { label, orientation = "horizontal", length = 160, ends = "arrow", className, ...props },
  ref,
) {
  if (orientation === "vertical") {
    const w = 52;
    const x = 11;
    const y1 = 1;
    const y2 = length - 1;
    return (
      <svg
        ref={ref}
        width={w}
        height={length}
        viewBox={`0 0 ${w} ${length}`}
        fill="none"
        strokeWidth={1}
        className={cn("stroke-rule", className)}
        role="img"
        aria-label={label}
        focusable="false"
        {...props}
      >
        <line x1={x} y1={y1} x2={x} y2={y2} />
        <Cap x={x} y={y1} dir="up" ends={ends} />
        <Cap x={x} y={y2} dir="down" ends={ends} />
        <text
          x={x + 9}
          y={length / 2}
          textAnchor="start"
          dominantBaseline="middle"
          fontSize={11}
          className="fill-foreground font-mono font-medium"
        >
          {label}
        </text>
      </svg>
    );
  }

  const band = 16;
  const h = band + 12;
  const y = band + 5;
  const x1 = 1;
  const x2 = length - 1;
  return (
    <svg
      ref={ref}
      width={length}
      height={h}
      viewBox={`0 0 ${length} ${h}`}
      fill="none"
      strokeWidth={1}
      className={cn("stroke-rule", className)}
      role="img"
      aria-label={label}
      focusable="false"
      {...props}
    >
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <Cap x={x1} y={y} dir="left" ends={ends} />
      <Cap x={x2} y={y} dir="right" ends={ends} />
      <text
        x={length / 2}
        y={band - 4}
        textAnchor="middle"
        fontSize={11}
        className="fill-foreground font-mono font-medium"
      >
        {label}
      </text>
    </svg>
  );
});
