/**
 * The cross-family chart interaction contract (#349).
 *
 * ONE payload shape for every chart family, so a consumer writes a single
 * drill-down handler and reuses it on a bar chart, a line chart and a pie chart.
 * The issue sketched a positional `(datum, series, event)` signature; a single
 * object is used instead because the families disagree on what a "series" is
 * (pie/ring/funnel have none) and because adding a field later to a positional
 * signature is a breaking change.
 */

/** A single activated datapoint, whatever family it came from. */
export interface ChartDatapoint<TDatum = Record<string, unknown>> {
  /** The raw data row that produced this datapoint. */
  datum: TDatum;
  /** Index into the chart's `data` array. */
  index: number;
  /** Series `dataKey`. Undefined for single-series categorical families (pie/ring/funnel). */
  seriesKey?: string;
  /** Legend/series label when the chart knows one. */
  seriesLabel?: string;
  /** The numeric value at this datapoint. */
  value: number | undefined;
  /** The category / x value — a string for categorical scales, a `Date` for time scales. */
  category: string | number | Date | undefined;
  /** How activation happened — lets a consumer distinguish a pointer drill from a keyboard drill. */
  source: "pointer" | "keyboard";
}

/** Fired when a datapoint is activated by pointer OR keyboard. */
export type ChartDatapointClickHandler<TDatum = Record<string, unknown>> = (
  point: ChartDatapoint<TDatum>,
  event: React.MouseEvent | React.KeyboardEvent,
) => void;

/**
 * Overrides the accessible name of a keyboard target. Default:
 * `"<series>, <category>: <value>"` (or `"<category>: <value>"` without a series).
 */
export type ChartDatapointLabel<TDatum = Record<string, unknown>> = (
  point: Omit<ChartDatapoint<TDatum>, "source">,
) => string;

/** Props every interactive chart container accepts. Spread into the family's own props. */
export interface ChartInteractionProps<TDatum = Record<string, unknown>> {
  /**
   * Fires when a datapoint is activated by pointer OR keyboard. Setting it is
   * what enables the interaction layer — with it unset the chart renders
   * exactly as before, with no extra DOM and no new focusables.
   */
  onDatapointClick?: ChartDatapointClickHandler<TDatum>;
  /**
   * Put the datapoint's EXACT value on the clipboard when it is activated —
   * the recovery path for compact axis labels and tooltips, reachable by mouse
   * AND keyboard because activation rides `ChartDatapointLayer`'s real buttons.
   *
   * Default `false` on a raw chart container: turning it on mounts the
   * interaction layer, and the documented guarantee is that a chart with no
   * interaction props renders byte-identical DOM. `AutoChart` — the
   * spec-driven surface, where the caller never sees the axis config — turns
   * it on by default.
   *
   * A consumer-supplied `onDatapointClick` always wins; the two never both run.
   */
  copyValueOnActivate?: boolean;
  /** Override the accessible name of each keyboard target. */
  datapointLabel?: ChartDatapointLabel<TDatum>;
  /**
   * Dev-warning threshold on the number of keyboard targets. Default 500.
   * NOT a functional cap — every plotted point stays reachable, so a keyboard
   * user can reach exactly what a mouse user can click.
   */
  maxInteractiveDatapoints?: number;
}
