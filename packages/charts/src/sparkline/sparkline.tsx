"use client";

/**
 * Sparkline (#L17) — the word-sized micro-chart. No axes, no tooltip, no
 * engine: a single inline SVG sized to sit next to text (a MetricCard, a table
 * cell, an activity strip). Color rides on `currentColor`, so consumers theme
 * it with a text token (`text-muted-foreground` by default); the optional
 * emphasized last point uses `--chart-1`.
 */
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { forwardRef, useMemo, type SVGAttributes } from "react";
import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";

export interface SparklineProps extends Omit<SVGAttributes<SVGSVGElement>, "children" | "values"> {
  /** The series, oldest → newest. */
  values: number[];
  /** Visual form. Default "bar". */
  variant?: "bar" | "line";
  /** Emphasize the newest value with the `--chart-1` token. Default true for bars. */
  emphasizeLast?: boolean;
  /** Accessible name. Default describes the series. */
  label?: string;
  /** Rendered size; the SVG also scales to its CSS box. */
  width?: number;
  height?: number;
}

const BAR_GAP = 1.5;

/**
 * Nonzero values keep at least this share of the drawable height. Without a
 * floor, a series with one large outlier renders every other bar as a 1px
 * dash that reads as "broken" at word size; zero stays a 1px baseline stub so
 * "no activity" remains distinguishable from "some activity".
 */
const MIN_BAR_RATIO = 0.15;

export const Sparkline = forwardRef<SVGSVGElement, SparklineProps>(function Sparkline(
  {
    values,
    variant = "bar",
    emphasizeLast = variant === "bar",
    label,
    width = 80,
    height = 20,
    className,
    ...props
  },
  ref,
) {
  const max = useMemo(() => Math.max(...values, 0), [values]);

  const ariaLabel =
    label ??
    (values.length
      ? `Trend of ${values.length} values, latest ${values[values.length - 1]}`
      : "No data");

  if (values.length === 0) {
    return (
      <svg
        ref={ref}
        role="img"
        aria-label={ariaLabel}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn("text-muted-foreground", className)}
        {...props}
      >
        <line
          x1={0}
          y1={height - 0.5}
          x2={width}
          y2={height - 0.5}
          stroke="var(--chart-grid)"
          strokeWidth={CHART_HAIRLINE_WIDTH}
        />
      </svg>
    );
  }

  const points = values.map((v, i) => {
    const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * (width - 2) + 1;
    const y = max === 0 ? height - 1 : height - 1 - (v / max) * (height - 2);
    return `${x},${y}`;
  });

  return (
    <svg
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 text-muted-foreground", className)}
      {...props}
    >
      {variant === "bar" ? (
        values.map((v, i) => {
          const barWidth = Math.max(1, (width - BAR_GAP * (values.length - 1)) / values.length);
          const h =
            max === 0 || v <= 0
              ? 1
              : Math.max(MIN_BAR_RATIO * (height - 1), (v / max) * (height - 1));
          const isLast = i === values.length - 1;
          return (
            <rect
              key={i}
              x={i * (barWidth + BAR_GAP)}
              y={height - h}
              width={barWidth}
              height={h}
              rx={0.5}
              fill={isLast && emphasizeLast ? "var(--chart-1)" : "currentColor"}
              fillOpacity={isLast && emphasizeLast ? 1 : 0.55}
            />
          );
        })
      ) : (
        <>
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {emphasizeLast ? (
            <circle
              cx={points[points.length - 1]!.split(",")[0]}
              cy={points[points.length - 1]!.split(",")[1]}
              r={2}
              fill="var(--chart-1)"
            />
          ) : null}
        </>
      )}
    </svg>
  );
});
