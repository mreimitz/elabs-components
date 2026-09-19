"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { NumericExtent } from "../cell-scales";
import { BAR_CELL_NEGATIVE_COLOR, BAR_CELL_POSITIVE_COLOR } from "./bar-cell";

/** The zero rule's width (px) — the charts hairline, mirrored. */
export const COLUMNS_CELL_HAIRLINE_WIDTH = 0.65;
const VIEW_WIDTH = 100;
const GAP = 12; // % of a slot left empty between columns

export interface ColumnsCellProps extends HTMLAttributes<HTMLDivElement> {
  /** One entry per row key, in x order; a `null` value draws no column. */
  values: readonly { key: string; value: number | null }[];
  /** The value domain: this row's own extent or the column's. Zero is always added. */
  domain: NumericExtent | null;
  /** Every value as text, for screen readers, sorting and copy. */
  label: string;
  /** Drawing height in px. Default 24. */
  height?: number;
}

/** In-cell mini columns: a ≤ 40-line inline SVG, columns grow from a zero rule. */
export const ColumnsCell = forwardRef<HTMLDivElement, ColumnsCellProps>(function ColumnsCell(
  { values, domain, label, height = 24, className, ...props },
  ref,
) {
  const h = Math.max(0, height);
  const lo = Math.min(0, domain?.min ?? 0);
  const hi = Math.max(0, domain?.max ?? 0);
  const span = hi - lo;
  const y = (v: number) => (span > 0 ? ((hi - v) / span) * h : h);
  const slot = values.length > 0 ? VIEW_WIDTH / values.length : 0;
  const width = Math.max(0, slot * (1 - GAP / 100));
  return (
    <div
      ref={ref}
      data-slot="columns-cell"
      className={cn("flex min-w-0 items-center", className)}
      {...props}
    >
      <span className="sr-only">{label}</span>
      <svg
        aria-hidden="true"
        data-slot="columns-cell-svg"
        data-y-min={lo}
        data-y-max={hi}
        viewBox={`0 0 ${VIEW_WIDTH} ${h}`}
        preserveAspectRatio="none"
        className="block min-w-8 flex-1"
        style={{ height: h }}
      >
        {values.map(({ key, value: v }, i) =>
          v === null ? null : (
            <rect
              key={key}
              data-slot="columns-cell-column"
              x={i * slot + (slot - width) / 2}
              y={Math.min(y(v), y(0))}
              width={width}
              height={Math.max(0, Math.abs(y(v) - y(0)))}
              fill={v < 0 ? BAR_CELL_NEGATIVE_COLOR : BAR_CELL_POSITIVE_COLOR}
            />
          ),
        )}
        <line
          x1={0}
          x2={VIEW_WIDTH}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--chart-grid)"
          strokeWidth={COLUMNS_CELL_HAIRLINE_WIDTH}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
});
