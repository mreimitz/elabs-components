/**
 * Legible series ink for TEXT (RM-111).
 *
 * A series token (`--chart-1`..`--chart-12`) is a mark ramp, 1.4.11-exempt and
 * often far too light for 11px text: the brand lime `--chart-1` is 1.42:1 on
 * the light card. Text tied to a series therefore paints the series stroke
 * pulled toward the label ink, `color-mix(in oklch, <stroke> N%, var(--chart-label))`,
 * so it keeps its hue and still reads. Marks that are not text (connectors,
 * marker rings) keep the pure stroke.
 *
 * `N` is the LARGEST percentage at which the lightest series of the bikes
 * recipe, `--chart-1`, reaches 4.5:1 against `--chart-background` in both
 * reference themes, measured in Chromium (sRGB, WCAG 2 relative luminance):
 *
 * | N  | light `--chart-1` | dark `--chart-1` |
 * | -- | ----------------- | ---------------- |
 * | 46 | < 4.5 : 1         | —                |
 * | 45 | 4.53 : 1          | 12.76 : 1        |
 *
 * The dark theme passes at every N (its label ink is the light one), so the
 * light theme sets the number.
 */
export const LEGIBLE_SERIES_INK_PERCENT = 45;

/** The text ink for a series-coloured note, key-marker number or row note. */
export function legibleSeriesInk(stroke: string): string {
  return `color-mix(in oklch, ${stroke} ${LEGIBLE_SERIES_INK_PERCENT}%, var(--chart-label))`;
}
