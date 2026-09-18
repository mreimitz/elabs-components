/**
 * series-label-ink — the text colour for a label painted "in its series'
 * colour" (RM-110): end labels, key rows, and value labels with `matchColor`.
 *
 * The series ramp (`--chart-1..12`) is a 1.4.11 mark ramp, not a text rung: on
 * `--chart-background` no built-in series reaches 4.5:1 in every built-in
 * theme (light `--chart-10` measures 1.16:1, dark `--chart-11` 3.15:1). So the
 * text never uses the pure stroke; it mixes the stroke toward `--chart-label`.
 * The line, swatch and marker keep the pure stroke.
 */

/**
 * Share of the series stroke in the text colour, percent. The largest N at
 * which EVERY built-in series still reaches 4.5:1 on `--chart-background` in
 * every built-in theme, measured in the browser (2026-09-18). The binding case
 * is light `--chart-10` (4.53:1 at 41 %); `--chart-1` alone would allow 45 %.
 */
export const SERIES_LABEL_INK_MIX = 41;

/** The text colour for a label in `stroke`'s series colour. */
export function seriesLabelInk(stroke: string): string {
  // A paint server (`url(#gradient)`) cannot be mixed: fall back to the label ink.
  if (stroke.trim().startsWith("url(")) return "var(--chart-label)";
  return `color-mix(in oklch, ${stroke} ${SERIES_LABEL_INK_MIX}%, var(--chart-label))`;
}
