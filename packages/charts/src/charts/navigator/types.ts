/**
 * navigator/types.ts — the window model of ADR 0040 §2 (RM-136).
 *
 * One strip (`ChartNavigator`, RM-140) serves two window kinds: a continuous
 * `time` window (feeds the time-series shell's existing `xDomain`) and a
 * discrete `index` window over categories (the associative BI suite's scroll, RM-141). The strip
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
 * `"miniChart"` — the associative BI suite's condensed overview strip with a draggable window;
 * `"bar"` — a plain scrollbar strip; `"auto"` — the mini chart appears only once
 * the rows exceed `maxVisiblePoints` / `maxVisibleItems` (the associative BI suite's rule, opt-in);
 * `"none"` — no strip, the chart shows the whole dataset (or trims, on category
 * families, as it does today).
 */
export type ChartScrollbarMode = "miniChart" | "bar" | "auto" | "none";

/** Why a window changed — mid-gesture previews vs a settled value. */
export type NavigatorChangePhase = "move" | "commit";

export interface NavigatorChangeMeta {
  phase: NavigatorChangePhase;
  source: "pointer" | "keyboard" | "wheel" | "touch" | "program";
}

/** The props every navigator-aware container accepts. */
export interface ChartNavigatorProps {
  /**
   * Strip style. Default `"none"` — a chart never grows a strip on its own
   * (ADR 0040 decision b); a `window` / `defaultWindow` turns it on, as does
   * `"miniChart"` / `"bar"` / `"auto"`.
   */
  scrollbar?: ChartScrollbarMode;
  /** Controlled window. */
  window?: NavigatorWindow | null;
  /** Initial window for the uncontrolled case. */
  defaultWindow?: NavigatorWindow;
  onWindowChange?: (window: NavigatorWindow | null, meta: NavigatorChangeMeta) => void;
  /**
   * Smallest window the user can make: a duration in ms (time) or a row count
   * (index). Default: 5× the median step (time; the stock-chart library' rule) / 3 (index).
   */
  minSpan?: number;
  /** Where an automatic first window sits. `"end"` = the latest data (the associative BI suite `scrollStartPos: 1`). Default `"start"`. */
  align?: "start" | "end";
  /**
   * Category families (RM-141): how many categories the plot shows at once
   * (the associative BI suite "Number of bars"). Default `"auto"` — as many as
   * keep a readable band (`maxReadableCategories`); with `scrollbar="auto"`
   * the strip appears only once the categories overflow that count.
   */
  maxVisibleItems?: Responsive<number | "auto">;
  /** Time-series families: with `scrollbar="auto"`, rows above this show the strip. Default 2000. */
  maxVisiblePoints?: number;
  /**
   * Category families: `"all"` (default) keeps the value axis on the FULL
   * data's domain while scrolling; `"visible"` refits it to the window.
   */
  windowDomain?: "all" | "visible";
  /**
   * Pinch-to-zoom along the x axis (time x): two fingers on a touch screen, a
   * trackpad pinch, or Ctrl/⌘ + wheel narrow the same window the strip moves;
   * a two-finger drag pans it. `+` / `−` / `0` on the focused chart and the
   * zoom buttons that appear once zoomed do the same from the keyboard. No
   * strip is needed; with one, it follows. Default `true`; `false` leaves the
   * gestures to the page. Off while the caller drives `xDomain` itself.
   */
  zoom?: boolean;
}

/**
 * The navigator props a category family accepts (RM-141): `BarChart` and
 * `HeatmapChart`. `maxVisiblePoints` is the time families' cap and has no
 * meaning on a category axis.
 */
export type ChartCategoryNavigatorProps = Omit<ChartNavigatorProps, "maxVisiblePoints">;
