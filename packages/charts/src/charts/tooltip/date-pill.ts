/**
 * The crosshair date pill (`DateTicker`, the live chart's time pill) sits in
 * the gutter UNDER the plot, 4px off the chart's bottom edge, 32px tall
 * (`py-1` + an `h-6` line). A chart whose bottom margin cannot hold it —
 * a sparkline-sized panel, a small multiple — shows no pill: painted anyway,
 * it would cover most of the plot and the tooltip box with it.
 *
 * One predicate for the pill AND the x-axes, whose tick labels fade near the
 * crosshair only to make room for the pill.
 */

export const DATE_PILL_HEIGHT = 32;
export const DATE_PILL_BOTTOM = 4;

export function datePillFits(marginBottom: number): boolean {
  return marginBottom >= DATE_PILL_HEIGHT + DATE_PILL_BOTTOM;
}
