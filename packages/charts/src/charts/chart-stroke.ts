/**
 * chart-stroke.ts — the selection paint's stroke width and dash constants
 * (RM-073, RM-173).
 *
 * Split out of `chart-selection.ts`, which also imports React and
 * `chart-context`, so a chart prop group can reference these without pulling
 * either into the pure definition layer. `chart-selection.ts` re-exports
 * every name here, so every existing import keeps working unchanged. The
 * matching inks (`SELECTED_OUTLINE_COLOR`, `SELECTED_OUTLINE_CORE_COLOR`,
 * `EXCLUDED_FRAME_COLOR`) stay in `chart-selection.ts` — they read
 * `chartCssVars`, which is not pure.
 */

import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";

/**
 * Total width of a `selected` mark's compound outline: the `--chart-foreground`
 * band, of which the middle third is overpainted by the `--chart-background`
 * core (`SELECTED_OUTLINE_CORE_WIDTH`) — foreground | background | foreground.
 */
export const SELECTED_OUTLINE_WIDTH = 4;

/** Width of the `--chart-background` core splitting the selected outline. */
export const SELECTED_OUTLINE_CORE_WIDTH = SELECTED_OUTLINE_WIDTH / 3;

/** Dash of an excluded mark's frame. */
export const EXCLUDED_DASH_ARRAY = "4 3";

/**
 * Stroke width of an excluded mark's dashed frame — the weight the RM-073 hatch
 * used, so the channel stays a hairline-family line, not a second outline.
 */
export const EXCLUDED_FRAME_WIDTH = CHART_HAIRLINE_WIDTH * 2;
