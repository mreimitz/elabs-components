/**
 * chart-a11y-types.ts — the accessible-label prop pair every chart accepts
 * (RM-173).
 *
 * Split out of `chart-a11y.tsx`, which also imports React and `ui`, so a
 * chart prop group can reference `ChartA11yProps` without pulling either into
 * the pure definition layer. `chart-a11y.tsx` re-exports it, so every
 * existing import keeps working unchanged.
 */
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
