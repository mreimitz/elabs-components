"use client";

/**
 * chart-a11y — shared accessible-label utilities for @qlik-coe-emea/qlabs-components-charts.
 *
 * Issue #145. All chart SVG bodies use aria-hidden="true" because the raw SVG
 * paths carry no semantic meaning for AT users. This module provides:
 *
 * 1. `ChartA11yLabel` — a visually-hidden label + optional description element.
 *    Place it as the FIRST child of a chart container `<div>` so AT reads it
 *    before (or in place of) the hidden SVG.
 *
 * 2. `chartA11yProps` — helper that returns the correct `role`, `aria-label`,
 *    and `aria-describedby` props for a chart container div given an accessible
 *    label and optional description id.
 *
 * Usage in a chart container:
 * ```tsx
 * const descId = useId();
 * <div role="figure" aria-label={accessibleLabel} aria-describedby={accessibleDescription ? descId : undefined} ...>
 *   <ChartA11yLabel descId={descId} description={accessibleDescription} />
 *   {children}
 * </div>
 * ```
 *
 * Design decisions:
 * - `role="figure"` (not `role="img"`) because a figure is a self-contained
 *   unit of content with optional caption, and `<figcaption>` semantics map
 *   naturally to the description. A pure `role="img"` would require AT to treat
 *   the whole thing as a single image, but figures allow sub-navigation.
 * - The visually-hidden description uses `id` + `aria-describedby` so it is
 *   supplemental — screen readers announce it after the label, not instead.
 * - The container is `tabIndex={0}` (keyboard-reachable) so keyboard users can
 *   focus the chart region and hear its description without needing to tab
 *   through the internal SVG (which has no keyboard affordances anyway).
 */

import { useId } from "react";

export interface ChartA11yProps {
  /**
   * Accessible name for the chart region. AT announces this when the container
   * receives focus or is read in flow. Example: "Monthly revenue bar chart"
   */
  accessibleLabel?: string;
  /**
   * Supplemental description (series names, value ranges, last values, etc.).
   * Rendered as a visually-hidden `<span>` associated via `aria-describedby`.
   * Example: "Series: Revenue, Expenses. Range: 0–25,000."
   */
  accessibleDescription?: string;
}

/** Visually-hidden description element. Renders nothing when `description` is absent. */
export function ChartA11yLabel({
  descId,
  description,
}: {
  descId: string;
  description: string | undefined;
}) {
  if (!description) return null;
  return (
    <span className="sr-only" id={descId}>
      {description}
    </span>
  );
}

/**
 * Returns the `role`, `aria-label`, `aria-describedby`, and `tabIndex` props
 * to spread onto a chart container `<div>`.
 *
 * When neither label nor description is provided the chart container carries no
 * additional ARIA burden (the SVG is already aria-hidden; axe passes).
 */
export function useChartA11yContainerProps(
  accessibleLabel: string | undefined,
  accessibleDescription: string | undefined,
): {
  role: string | undefined;
  "aria-label": string | undefined;
  "aria-describedby": string | undefined;
  tabIndex: number | undefined;
  descId: string;
} {
  const descId = useId();
  const hasLabel = Boolean(accessibleLabel);
  const hasDesc = Boolean(accessibleDescription);

  return {
    role: hasLabel ? "figure" : undefined,
    "aria-label": accessibleLabel,
    "aria-describedby": hasDesc ? descId : undefined,
    tabIndex: hasLabel ? 0 : undefined,
    descId,
  };
}
