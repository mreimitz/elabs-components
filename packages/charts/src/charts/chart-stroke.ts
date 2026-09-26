/**
 * chart-stroke.ts — the selection paint's stroke width and dash constants
 * (RM-073, RM-173), and the one chart dash map (RM-188).
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

/**
 * The one dash map (RM-188): every dashed or dotted chart stroke names its
 * rhythm here instead of writing a literal, so a threshold, a trend fit and a
 * model path keep telling themselves apart the same way on every family.
 * Seeded from the annotation layer's line styles (`dashed` / `dotted`); the
 * other entries are the rhythms the painters already used, verbatim.
 * `pnpm check --rule chart-style-constants` counts the literals left outside it.
 */
export const CHART_DASH = {
  /** A threshold or reference rule, an excluded mark's frame, a lasso outline. */
  dashed: "4 3",
  /** A dotted rule (the annotation layer's `dotted` style). */
  dotted: "1 3",
  /** A least-squares trend fit (`TrendLine`, Scatter `trend`). */
  trend: "5 4",
  /** A model path — the analytic trend and forecast (ADR 0040). */
  model: "6 4",
  /** A short guide: a highlighted row's frame, a target tick. */
  guide: "2 3",
  /** A leader between a reference ring and its label. */
  leader: "1.5 2.5",
  /** The third model path's rhythm on one chart (`ANALYTIC_DASHES`). */
  dashDot: "10 3 2 3",
  /** The fourth model path's rhythm on one chart (`ANALYTIC_DASHES`). */
  sparse: "1 4",
  /** The third solid overlay's rhythm beside a measure (`ANALYTIC_SOLID_RHYTHMS`). */
  dotDash: "6 2 1 2",
} as const;

/** A named rhythm of {@link CHART_DASH}. */
export type ChartDashName = keyof typeof CHART_DASH;

/** An annotation line style → its dash (`solid` → no dash). */
export const LINE_STYLE_DASH: Readonly<Record<"solid" | "dashed" | "dotted", string | undefined>> =
  {
    solid: undefined,
    dashed: CHART_DASH.dashed,
    dotted: CHART_DASH.dotted,
  };

/** Dash of an excluded mark's frame. */
export const EXCLUDED_DASH_ARRAY = CHART_DASH.dashed;

/**
 * Stroke width of an excluded mark's dashed frame — the weight the RM-073 hatch
 * used, so the channel stays a hairline-family line, not a second outline.
 */
export const EXCLUDED_FRAME_WIDTH = CHART_HAIRLINE_WIDTH * 2;
