/**
 * on-mark-ink.story-measure.ts — STORY-ONLY. Measures an on-mark ink against
 * the mark it is printed on in a real browser (#238, #243).
 *
 * jsdom cannot resolve `var()`, and axe's `color-contrast` rule does not read
 * SVG fills, so the only place the rendered claim is measurable is a story's
 * `play` under `@storybook/addon-vitest`. Colours go through a 1×1 canvas, so
 * whatever the browser serialises (`rgb()`, `oklch()`, …) is converted to real
 * sRGB bytes the same way it is painted.
 */

type Rgb = [number, number, number];

let ctx: CanvasRenderingContext2D | null = null;

function context(): CanvasRenderingContext2D {
  if (!ctx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("on-mark-ink.story-measure: no 2D canvas context");
  }
  return ctx;
}

/** `color` at `alpha` over the opaque `ground`, as painted sRGB (0–1). */
export function paintedSrgb(color: string, ground: string, alpha = 1): Rgb {
  const c = context();
  c.globalAlpha = 1;
  c.clearRect(0, 0, 1, 1);
  c.fillStyle = ground;
  c.fillRect(0, 0, 1, 1);
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  return [(r ?? 0) / 255, (g ?? 0) / 255, (b ?? 0) / 255];
}

function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRgb(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** One measured pairing, labelled for the failure message. */
export interface InkMeasurement {
  label: string;
  ratio: number;
}

/**
 * Contrast of `inkEl`'s computed `paint` (`fill` or `stroke`) against
 * `plateEl`'s computed fill, composited at the plate's own opacity over the
 * chart ground read off `groundEl`.
 */
export function measureInkOnPlate(
  inkEl: Element,
  paint: "fill" | "stroke",
  plateEl: Element,
  groundEl: Element,
  label: string,
): InkMeasurement {
  const groundColor = getComputedStyle(groundEl).getPropertyValue("--chart-background").trim();
  const plateStyle = getComputedStyle(plateEl);
  const alpha = Number(plateStyle.opacity || 1) * Number(plateStyle.fillOpacity || 1);
  const plate = paintedSrgb(plateStyle.fill, groundColor, alpha);
  const ink = paintedSrgb(getComputedStyle(inkEl)[paint], groundColor);
  return { label, ratio: contrastRgb(ink, plate) };
}

/** A readable list of the pairings under `min`. */
export function failingMeasurements(measurements: InkMeasurement[], min: number): string[] {
  return measurements
    .filter((m) => !(m.ratio >= min))
    .map((m) => `${m.label} = ${m.ratio.toFixed(2)}:1`);
}
