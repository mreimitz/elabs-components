"use client";

import type { ReactNode } from "react";

export interface LinePeakLabelsProps {
  /** The series whose peaks the group holds. */
  series: string;
  children: ReactNode;
}

/**
 * The group a `labelPeaks` Line paints its peak labels into. The label engine
 * places the peaks (RM-110), but the group keeps the `line-peak-labels` slot
 * Line has published since RM-028, so consumers and tests still find it.
 *
 * Lives in its own module, not in `line.tsx`: every cartesian chart reaches
 * `value-labels.tsx` through the time-series shell, and importing `line.tsx`
 * from there would ship Line's part definition in a BarChart-only bundle
 * (`check-chart-treeshake.mjs`, ADR 0042 §11).
 */
export function LinePeakLabels({ series, children }: LinePeakLabelsProps) {
  return (
    <g aria-hidden="true" data-series={series} data-slot="line-peak-labels">
      {children}
    </g>
  );
}
