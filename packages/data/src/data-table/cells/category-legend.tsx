"use client";

import { forwardRef, type HTMLAttributes } from "react";
import type { ColorScale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface CategoryLegendProps extends HTMLAttributes<HTMLDivElement> {
  /** A categorical scale — its `categories`, in first-seen order. */
  scale: ColorScale;
  /** What the colours divide the rows BY (the `colorBy` key, or a nicer name). */
  title?: string;
  /** Print a category value; defaults to `String`. */
  formatCategory?: (value: string | number) => string;
}

/**
 * A `colorBy` column's colour key: one named swatch per category.
 *
 * A categorical fill answers "which group", and unlike a bar's length or a
 * heatmap's ramp there is nothing in the cell to read it off. Without a key the
 * category is carried by hue alone — unreadable to anyone who cannot separate
 * those hues, and unnameable by everyone else (WCAG 1.4.1). This is the same
 * key `HeatmapLegend` gives an ordered scale, for an unordered one.
 */
export const CategoryLegend = forwardRef<HTMLDivElement, CategoryLegendProps>(
  function CategoryLegend({ scale, title, formatCategory = String, className, ...props }, ref) {
    if (scale.categories.length === 0) return null;
    return (
      <div
        ref={ref}
        role="group"
        aria-label={title}
        data-slot="category-legend"
        className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-meta", className)}
        {...props}
      >
        {title && (
          <span aria-hidden="true" className="text-muted-foreground">
            {title}
          </span>
        )}
        <ul className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {scale.categories.map((category) => (
            <li key={String(category.value)} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                data-slot="category-legend-swatch"
                className="block size-2.5 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span>{formatCategory(category.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  },
);
