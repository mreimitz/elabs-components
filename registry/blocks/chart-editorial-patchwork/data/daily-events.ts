/** One event per row — an hour of day (0–23, fractional allowed) plus a category. */
export interface PatchworkEvent {
  hour: number;
  category: string;
  /** Relative weight, 0–1. Drives how dark the overlaid wash reads (not the shape). */
  weight?: number;
}

/** A day's worth of support-ticket opens, meeting starts and deploys. */
export const DAILY_EVENTS: PatchworkEvent[] = [
  { hour: 6.5, category: "Deploy", weight: 0.4 },
  { hour: 7, category: "Meeting", weight: 0.5 },
  { hour: 8, category: "Support", weight: 0.6 },
  { hour: 8.5, category: "Meeting", weight: 0.4 },
  { hour: 9, category: "Support", weight: 0.8 },
  { hour: 9.5, category: "Support", weight: 0.7 },
  { hour: 10, category: "Deploy", weight: 0.6 },
  { hour: 10, category: "Meeting", weight: 0.5 },
  { hour: 11, category: "Support", weight: 0.9 },
  { hour: 11.5, category: "Support", weight: 0.6 },
  { hour: 12, category: "Meeting", weight: 0.3 },
  { hour: 13, category: "Support", weight: 0.5 },
  { hour: 13.5, category: "Deploy", weight: 0.7 },
  { hour: 14, category: "Meeting", weight: 0.6 },
  { hour: 14.5, category: "Support", weight: 0.8 },
  { hour: 15, category: "Support", weight: 0.9 },
  { hour: 15.5, category: "Deploy", weight: 0.5 },
  { hour: 16, category: "Meeting", weight: 0.4 },
  { hour: 16.5, category: "Support", weight: 0.7 },
  { hour: 17, category: "Support", weight: 0.5 },
  { hour: 18, category: "Deploy", weight: 0.3 },
  { hour: 20, category: "Deploy", weight: 0.2 },
  { hour: 23, category: "Support", weight: 0.15 },
  { hour: 2, category: "Support", weight: 0.1 },
];

/** Category → chart series token index (1–12), assigned in first-seen order. */
export function categoryTokenIndex(categories: string[], category: string): number {
  const i = categories.indexOf(category);
  return ((i >= 0 ? i : 0) % 12) + 1;
}

/**
 * A category's non-hue stroke signature — the WCAG 1.4.1 "colour is never the
 * only channel" fix (#293). Cycles through a small, visually distinct set of
 * `stroke-dasharray` values (SVG user units) in the same first-seen order as
 * `categoryTokenIndex`, so a category always gets the same signature on both
 * the wedge and the legend swatch. `label` is what the `sr-only` summary
 * names; `dasharray` of `undefined` renders a solid line.
 */
export interface CategoryStrokeSignature {
  label: string;
  dasharray: string | undefined;
}

const CATEGORY_STROKE_SIGNATURES: CategoryStrokeSignature[] = [
  { label: "solid outline", dasharray: undefined },
  { label: "dashed", dasharray: "5 3" },
  // Round `strokeLinecap` turns this near-zero dash into a dot the width of
  // the stroke itself, spaced 3.5 units apart — a true dotted line, not a
  // sub-pixel dashed one.
  { label: "dotted", dasharray: "0.5 3.5" },
];

export function categoryStrokeSignature(
  categories: string[],
  category: string,
): CategoryStrokeSignature {
  const i = categories.indexOf(category);
  const signature =
    CATEGORY_STROKE_SIGNATURES[(i >= 0 ? i : 0) % CATEGORY_STROKE_SIGNATURES.length];
  if (!signature) throw new Error("unreachable: modulo index always in range");
  return signature;
}
