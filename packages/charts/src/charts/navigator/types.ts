/**
 * navigator/types.ts — the window model of ADR 0040 §2 (RM-136).
 *
 * One strip (`ChartNavigator`, RM-140) serves two window kinds: a continuous
 * `time` window (feeds the time-series shell's existing `xDomain`) and a
 * discrete `index` window over categories (Qlik's scroll, RM-141). The strip
 * lives OUTSIDE `plotHeight`, so a chart's plot never changes size because a
 * navigator appeared.
 */

import type { Responsive } from "../chart-breakpoint";

/** A continuous window over a time axis. */
export interface NavigatorTimeWindow {
  kind: "time";
  start: Date;
  end: Date;
}

/** A discrete window over row indexes: `start` inclusive, `end` exclusive. */
export interface NavigatorIndexWindow {
  kind: "index";
  start: number;
  end: number;
}

export type NavigatorWindow = NavigatorTimeWindow | NavigatorIndexWindow;

/**
 * `"miniChart"` — Qlik's condensed overview strip with a draggable window;
 * `"bar"` — a plain scrollbar strip; `"none"` — no strip, the chart shows the
 * whole dataset (or trims, on category families, as it does today).
 */
export type ChartScrollbarMode = "miniChart" | "bar" | "none";

/** Why a window changed — mid-gesture previews vs a settled value. */
export type NavigatorChangePhase = "move" | "commit";

export interface NavigatorChangeMeta {
  phase: NavigatorChangePhase;
  source: "pointer" | "keyboard" | "wheel" | "touch" | "program";
}

/** The props every navigator-aware container accepts. */
export interface ChartNavigatorProps {
  /**
   * Strip style. Default: `"miniChart"` on time-series families once
   * `data.length > maxVisiblePoints` or `window` is controlled; category
   * families default to `"none"` until ADR 0040's decision (b) flips it.
   */
  scrollbar?: ChartScrollbarMode;
  /** Controlled window. */
  window?: NavigatorWindow | null;
  /** Initial window for the uncontrolled case. */
  defaultWindow?: NavigatorWindow;
  onWindowChange?: (window: NavigatorWindow | null, meta: NavigatorChangeMeta) => void;
  /**
   * Smallest window the user can make: a duration in ms (time) or a row count
   * (index). Default: 5× the median step (time; Highcharts' rule) / 3 (index).
   */
  minSpan?: number;
  /** Where an automatic first window sits. `"end"` = the latest data (Qlik `scrollStartPos: 1`). Default `"start"`. */
  align?: "start" | "end";
  /** Category families: how many categories the plot shows at once (Qlik "Number of bars"). */
  maxVisibleItems?: Responsive<number>;
  /** Time-series families: rows above this auto-enable the strip. Default 2000. */
  maxVisiblePoints?: number;
  /**
   * Category families: `"all"` (default) keeps the value axis on the FULL
   * data's domain while scrolling; `"visible"` refits it to the window.
   */
  windowDomain?: "all" | "visible";
}
