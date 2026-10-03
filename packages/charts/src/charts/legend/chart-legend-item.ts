// chart-legend-item.ts — the one legend row type.
//
// Every legend surface describes its rows with `ChartLegendItem`: the entries
// a chart container publishes, the legend the container engine mounts, the
// composable `Legend`, `pieLegendItems` and a scatter encoding key. Each keeps
// its own public name as an interface extending a `LegendItemShape` projection (the fields it uses,
// each required or optional exactly as before), so the names stay what
// consumers already hold while the fields are documented once, here.
//
// Internal: `ChartLegendItem` and `LegendItemShape` are not exported from the
// package entry point; the public names are `LegendItem`, `LegendItemData`,
// `PieLegendItem` and `ScatterEncodingLegendItem`.

import type { SeriesMarkerShape } from "../series-pattern";

export interface ChartLegendItem {
  /**
   * Stable identity for `hiddenKeys`/`onToggleKey`. A legend falls back to
   * `label` when unset.
   */
  key?: string;
  /** Display label */
  label: string;
  /**
   * The number the legend's value column prints for this row (a series
   * total, the last visible point, a slice or segment value, a point count —
   * the full list is on `ContainerLegendConfig.values`). A non-finite value
   * (`NaN`) means "no value": the column stays empty for the row instead of
   * printing "NaN". Unset on an entry with no number of its own; it never
   * falls back to 0.
   */
  value?: number;
  /** Maximum value (for progress / percentage calculation) */
  maxValue?: number;
  /** Item color */
  color?: string;
  /**
   * Series index for pattern/dash differentiation under high decoration.
   * When set, the swatch renders the decoration pattern instead of a solid dot.
   */
  seriesIndex?: number;
  /** What the row stands for: a series, a colour-key category, a comparison column or an overlay. */
  kind?: "series" | "color" | "comparison" | "overlay";
  /**
   * Swatch shape. Unset: the filled dot. `"dashed"`: a short dashed rule — a
   * model overlay (a trend, a forecast), never mistaken for a measured
   * series. `"hollow"`: a ring — border in the row's colour, transparent
   * fill — the shape channel a hollow-vs-filled pair (e.g. `DumbbellChart`'s
   * before/after markers) needs so the two stay distinguishable in greyscale
   * (WCAG 1.4.1), not colour-coded alone. `"bar"`/`"range"`/`"tick"`/`"dot"`:
   * how an overlay or comparison entry's glyph is drawn.
   */
  marker?: "dashed" | "hollow" | "bar" | "range" | "tick" | "dot";
  /** The dashed swatch's rhythm (`strokeDasharray`) — a second overlay's differs from the first's. */
  markerDash?: string;
  /** Overlay / comparison fill: solid or striped. */
  pattern?: "solid" | "stripes";
  /**
   * A scatter `shapeBy` key's point shape — the series marker vocabulary, plus
   * `DensityScatterChart`'s down triangle and minus. A container legend row
   * with a shape draws it as its swatch (the dot's own glyph, not a colour dot).
   */
  shape?: SeriesMarkerShape | "triangle-down" | "minus";
}

/**
 * A legend row that uses some of the legend fields: the `Present` ones are
 * always set, the `Optional` ones may be omitted, and the rest are absent.
 */
export type LegendItemShape<
  Present extends keyof ChartLegendItem,
  Optional extends keyof ChartLegendItem = never,
> = { [K in Present]-?: NonNullable<ChartLegendItem[K]> } & {
  [K in Optional]?: ChartLegendItem[K];
};

/** The markers a container legend row draws itself (the rest belong to published entries). */
export type LegendRowMarker = Extract<ChartLegendItem["marker"], "dashed" | "hollow">;

/** The markers a chart container publishes on an entry. */
export type LegendEntryMarker = Exclude<NonNullable<ChartLegendItem["marker"]>, "dashed">;
