/**
 * container-legend-types.ts — the `legend` prop shape every container legend
 * engine reads (RM-118, RM-173).
 *
 * Split out of `use-container-legend.ts`, which also imports React and `ui`,
 * so a chart prop group can reference `ContainerLegendProp` /
 * `ContainerLegendConfig` without pulling either into the pure definition
 * layer. `use-container-legend.ts` re-exports every name here, so every
 * existing import keeps working unchanged.
 */

import type { ReactNode } from "react";
import type { Responsive } from "../responsive";

export type ContainerLegendPosition = "top" | "bottom" | "left" | "right" | "none";
export type ContainerLegendLayoutMode = "row" | "stack" | "split";
export type ContainerLegendInteractive = "hover" | "toggle" | "none";

export interface ContainerLegendConfig {
  /** Where the legend mounts, relative to the plot. Never `left`/`right` at `narrow`. */
  position?: Responsive<ContainerLegendPosition>;
  /** `row`: one line, wraps. `stack`: one item per line. */
  layout?: Responsive<ContainerLegendLayoutMode>;
  /**
   * `"hover"` (default) — dims every other series, no series is ever hidden.
   * `"toggle"` — items are real `aria-pressed` buttons that hide a series.
   * `"none"` — a static key, no pointer/keyboard affordance at all.
   */
  interactive?: ContainerLegendInteractive;
  /**
   * With `interactive: "toggle"`: what hides an entry. `"item"` (default)
   * makes the entry itself the toggle. `"checkbox"` adds a small checkbox
   * after each entry, shown on hover or focus, and leaves a click on the
   * entry to the container (`DensityScatterChart` selects the class).
   */
  toggleControl?: "item" | "checkbox";
  /**
   * Show a value column beside each entry. Default `false`. What the number
   * means depends on the family (F09):
   *
   * - **Categorical** (`BarChart`, `RadarChart`, `DumbbellChart`): the
   *   series total over every category. That is each `Bar`'s column plus the
   *   `comparison` column, each polygon's values over the chart's metrics,
   *   and each end's (or `variant="dots"` key's) column.
   * - **Time series** (`LineChart`, `AreaChart`, `ComposedChart`): the
   *   series' last finite value inside the visible x window. The navigator
   *   window, a pinch zoom or `xDomain` narrow that window.
   * - **Part-to-whole**: each slice's value, after `groupSmall`
   *   (`PieChart`); each top-level group's total (`TreemapChart`); the first
   *   stage, which every stage's share is measured against (`FunnelChart`).
   * - **Scatter** (`ScatterChart`, `DensityScatterChart`): how many points
   *   the entry keys.
   *
   * An entry with no single number of its own leaves its column empty. These
   * are `BarChart` overlays, derived analytics series and a
   * `replace: true` window. The value never falls back to 0.
   *
   * Numbers use the chart's own value format: `valueFormat` on
   * `TreemapChart`/`DumbbellChart`, `formatValue` on `FunnelChart`, and on
   * cartesian charts the `valueFormat` of the `YAxis` (or `BarValueAxis`) on
   * each series' `yAxisId`. One format covers every entry, so series on two
   * value axes that format differently print plain grouped numbers, never
   * one axis' unit on the other's series. Everything else, point counts
   * included, prints plain grouped numbers.
   */
  values?: boolean;
  title?: ReactNode;
}

/** `legend` on every container this engine wires (RM-118). */
export type ContainerLegendProp = boolean | ContainerLegendConfig;
