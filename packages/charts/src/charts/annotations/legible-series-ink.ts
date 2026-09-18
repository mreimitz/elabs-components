/**
 * Legible series ink for TEXT (RM-111).
 *
 * A series token (`--chart-1`..`--chart-12`) is a mark ramp, 1.4.11-exempt and
 * often far too light for 11px text: the brand lime `--chart-1` is 1.42:1 on
 * the light card. Text tied to a series therefore paints the series stroke
 * pulled toward the label ink, `color-mix(in oklab, <stroke> N%, var(--chart-label))`,
 * so it keeps its hue and still reads. The mix is in oklab, not oklch: oklch
 * interpolates the hue angle, so a lime stroke mixed with the slate label ink
 * turns teal. Marks that are not text (connectors, marker rings) keep the pure
 * stroke.
 *
 * `N` is the LARGEST percentage at which EVERY built-in series, `--chart-1`
 * through `--chart-12`, reaches 4.5:1 against `--chart-background` in every
 * built-in theme, measured in Chromium (computed colour painted to a canvas,
 * sRGB read back, WCAG 2 relative luminance). The lowest series sets it:
 *
 * | N  | light, lowest series   | dark, lowest series    |
 * | -- | ---------------------- | ---------------------- |
 * | 42 | 4.40 : 1 (`--chart-10`) | 7.96 : 1 (`--chart-11`) |
 * | 41 | 4.53 : 1 (`--chart-10`) | 8.06 : 1 (`--chart-11`) |
 */
export const LEGIBLE_SERIES_INK_PERCENT = 41;

/** The text ink for a series-coloured note, key-marker number or row note. */
export function legibleSeriesInk(stroke: string): string {
  return `color-mix(in oklab, ${stroke} ${LEGIBLE_SERIES_INK_PERCENT}%, var(--chart-label))`;
}
