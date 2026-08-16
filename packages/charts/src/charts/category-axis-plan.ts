/**
 * planCategoryAxis — decide how a categorical axis renders its labels so they
 * FIT, instead of overprinting each other.
 *
 * Pure and React-free on purpose: `measure` is injected, so every branch is
 * unit-testable against a stub (no canvas, no jsdom, no DOM at all). The React
 * side (`use-text-measurer.ts`) only supplies the `measure` function and the
 * resolved line height.
 *
 * The cascade, in order — each rung is tried only when the one above fails:
 *
 *   1. container floor  — below `CATEGORY_AXIS_MIN_CONTAINER_WIDTH` there is no
 *                         honest way to show category text at all → `hidden`.
 *   2. horizontal       — every label fits inside its own band slot → render as
 *                         today.
 *   3. tilted (bottom)  — labels rotate 45°. Viability is PERPENDICULAR spacing,
 *                         not slot width: two parallel 45° baselines separated
 *                         by `slotSize` along the axis are `slotSize / √2` apart
 *                         measured perpendicular, so the test is
 *                         `slotSize >= lineHeightPx * √2`.
 *   4. trim             — ellipsize to whatever `maxExtent` can actually pay for
 *                         (binary-searched prefix + `…`).
 *   5. drop             — stride over the categories and RE-ENTER ONCE with
 *                         `slotSize * stride`; a strided axis is frequently wide
 *                         enough to go back to plain horizontal.
 *   6. hidden           — nothing legible survives.
 *
 * `placement: "left"` (the horizontal-bar category axis) never tilts — tilted
 * side labels are a legibility regression. There the slot is the band HEIGHT and
 * the budget is the gutter WIDTH, which is why the two placements share one
 * function instead of forking.
 */

/** How the axis ended up rendering. */
export type CategoryAxisMode = "horizontal" | "tilted" | "hidden";

/** Which side of the plot the category axis sits on. */
export type CategoryAxisPlacement = "bottom" | "left";

/**
 * Opt out of the whole cascade. `"off"` reproduces the pre-fit behaviour
 * byte-for-byte (count-capped stride, full labels, no reserved extent) and is
 * the pinned regression escape hatch.
 */
export type CategoryAxisFit = "auto" | "off";

/** Below this container width, category text is not worth the pixels. */
export const CATEGORY_AXIS_MIN_CONTAINER_WIDTH = 160;

/** Minimum breathing room between two neighbouring horizontal labels. */
export const CATEGORY_AXIS_LABEL_GAP = 6;

/** Gap between the plot edge and the label band. */
export const CATEGORY_AXIS_PADDING = 8;

/** Tilt angle, degrees. 45° is the only angle the perpendicular test assumes. */
export const CATEGORY_AXIS_TILT_DEG = 45;

/** An ellipsised label narrower than this carries no information — drop instead. */
export const CATEGORY_AXIS_MIN_TEXT_PX = 24;

/** Single-character ellipsis (never `...` — see interaction-guidelines). */
export const CATEGORY_AXIS_ELLIPSIS = "…";

const SQRT2 = Math.SQRT2;
const SIN_45 = Math.SQRT1_2;

/**
 * One category. Deliberately carries NO pixel position: nothing in the cascade
 * depends on where a band sits, only on how wide/tall its slot is — which is
 * what lets `BarChart` compute the plan for its margin reserve and the axis
 * component reuse that same plan, mapping `index` back to a scale position.
 */
export interface CategoryAxisEntry {
  /** The full category label — always the accessible name, never truncated. */
  label: string;
  /** Index in the chart's data array. */
  index: number;
}

export interface CategoryAxisPlanInput {
  categories: CategoryAxisEntry[];
  /** Default: `"bottom"`. */
  placement?: CategoryAxisPlacement;
  /** Band width (`"bottom"`) or band height (`"left"`), in px. */
  slotSize: number;
  /** Chart container width, for the legibility floor. */
  containerWidth: number;
  /** Px the axis may consume: height below the plot, or gutter width beside it. */
  maxExtent: number;
  /** Resolved line height of the label font, in px. */
  lineHeightPx: number;
  /** Injected text measurement — px width of `text` in the label font. */
  measure: (text: string) => number;
  /** Whether the cascade may stride over categories. Default: `true`. */
  allowDrop?: boolean;
  /** Floor on the stride: at most this many labels survive. */
  maxLabels?: number;
  /** Default: `"auto"`. */
  fit?: CategoryAxisFit;
}

export interface CategoryAxisPlannedLabel extends CategoryAxisEntry {
  /** What is painted — may be an ellipsised prefix of `label`. */
  display: string;
  truncated: boolean;
}

export interface CategoryAxisPlan {
  mode: CategoryAxisMode;
  labels: CategoryAxisPlannedLabel[];
  /** 1 = every category kept; n = every nth kept. */
  stride: number;
  /** Px the axis needs reserved. `0` when `mode === "hidden"` or `fit === "off"`. */
  requiredExtentPx: number;
  /** `0` unless `mode === "tilted"`. */
  angleDeg: number;
  /** Widest measured label among the ones actually kept. */
  maxTextWidthPx: number;
}

/**
 * The category names the axis will NOT paint, in source order.
 *
 * Every rung below "everything fits" takes names out of the DOM — a stride
 * drops some, `mode: "hidden"` drops all — and the chart body itself is
 * `aria-hidden` (`chart-a11y.tsx`), so a dropped name leaves the accessibility
 * tree entirely unless the axis re-states it. Before the fit cascade existed
 * the labels always rendered (overlapping, but present), so silently dropping
 * them would be a regression for AT even though it is a fix for sighted
 * readers. The axes render this list `sr-only`.
 */
export function unpaintedCategoryLabels(
  categories: readonly CategoryAxisEntry[],
  painted: readonly { index: number }[],
): string[] {
  if (painted.length === categories.length) {
    return [];
  }
  const shown = new Set(painted.map((label) => label.index));
  return categories.filter((entry) => !shown.has(entry.index)).map((entry) => entry.label);
}

const HIDDEN: CategoryAxisPlan = {
  mode: "hidden",
  labels: [],
  stride: 1,
  requiredExtentPx: 0,
  angleDeg: 0,
  maxTextWidthPx: 0,
};

/** Largest prefix of `text` whose rendered width (plus `…`) fits `budget`. */
function ellipsize(
  text: string,
  budget: number,
  measure: (text: string) => number,
): { display: string; truncated: boolean } {
  if (measure(text) <= budget) {
    return { display: text, truncated: false };
  }
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(text.slice(0, mid) + CATEGORY_AXIS_ELLIPSIS) <= budget) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  // Trailing whitespace before the ellipsis reads as a typo when six labels sit
  // in a row and only one of them happens to cut after a space ("Q1 Central …"
  // beside "Q3 Southe…"). Trimming can only make the string narrower, so the
  // budget the binary search just proved still holds.
  const prefix = text.slice(0, low).trimEnd();
  if (prefix.length === 0) {
    return { display: CATEGORY_AXIS_ELLIPSIS, truncated: true };
  }
  return { display: prefix + CATEGORY_AXIS_ELLIPSIS, truncated: true };
}

/** Stride floor imposed by `maxLabels` (1 when it does not bite). */
function countStride(total: number, maxLabels: number | undefined): number {
  if (!maxLabels || maxLabels <= 0 || total <= maxLabels) {
    return 1;
  }
  return Math.ceil(total / maxLabels);
}

function applyStride(categories: CategoryAxisEntry[], stride: number): CategoryAxisEntry[] {
  return stride <= 1 ? categories : categories.filter((_, i) => i % stride === 0);
}

/**
 * True when two DIFFERENT categories would paint the same string.
 *
 * "Q1 Western Region" and "Q1 Central Region" both clipped to "Q1…" is not a
 * shortened label, it is a false one: the axis now asserts that two bars carry
 * the same name. Genuinely duplicated category names are not ambiguous — they
 * are the data — so the comparison is display-collides-while-label-differs.
 */
function isAmbiguous(labels: CategoryAxisPlannedLabel[]): boolean {
  const firstLabelFor = new Map<string, string>();
  for (const label of labels) {
    const seen = firstLabelFor.get(label.display);
    if (seen !== undefined && seen !== label.label) {
      return true;
    }
    firstLabelFor.set(label.display, label.label);
  }
  return false;
}

/**
 * The densest run, at or above `fromStride`, whose painted labels are all
 * distinguishable — or `null` when even the sparsest one collides, which is the
 * cascade's cue to hide rather than lie.
 *
 * Every label is measured ONCE: the ellipsis budget is a property of the
 * reserved band, not of the stride, so widening the stride never changes what a
 * given label paints — only which labels are in the run. That is what keeps the
 * search cheap enough to be exhaustive.
 */
function densestUnambiguousRun(
  categories: CategoryAxisEntry[],
  fromStride: number,
  budget: number,
  measure: (text: string) => number,
  allowDrop: boolean,
): { labels: CategoryAxisPlannedLabel[]; stride: number } | null {
  const painted = categories.map((entry) => ({
    ...entry,
    ...ellipsize(entry.label, budget, measure),
  }));

  for (let stride = fromStride; stride <= categories.length; stride += 1) {
    const labels = applyStride(painted, stride) as CategoryAxisPlannedLabel[];
    if (!isAmbiguous(labels)) {
      return { labels, stride };
    }
    // `showAllLabels` means the caller would rather read every name than a
    // clean subset, so take the ambiguous run instead of thinning it.
    if (!allowDrop) {
      return { labels, stride };
    }
  }
  return null;
}

function passthrough(entries: CategoryAxisEntry[]): CategoryAxisPlannedLabel[] {
  return entries.map((entry) => ({ ...entry, display: entry.label, truncated: false }));
}

/**
 * Vertical px a 45°-rotated run of text consumes: the text's own length
 * projected onto the vertical axis, plus the glyph height's projection.
 */
function tiltedExtent(textWidthPx: number, lineHeightPx: number): number {
  return (textWidthPx + lineHeightPx) * SIN_45;
}

/** Inverse of `tiltedExtent` — the widest text a given extent can pay for. */
function tiltedTextBudget(extentPx: number, lineHeightPx: number): number {
  return extentPx * SQRT2 - lineHeightPx;
}

export function planCategoryAxis(input: CategoryAxisPlanInput): CategoryAxisPlan {
  const {
    categories,
    placement = "bottom",
    slotSize,
    containerWidth,
    maxExtent,
    lineHeightPx,
    measure,
    allowDrop = true,
    maxLabels,
    fit = "auto",
  } = input;

  if (categories.length === 0) {
    return { ...HIDDEN, mode: "horizontal" };
  }

  // Escape hatch: the pre-fit behaviour, verbatim. Reserves no extent, so the
  // chart's margins stay exactly where they were.
  if (fit === "off") {
    const stride = allowDrop ? countStride(categories.length, maxLabels) : 1;
    return {
      mode: "horizontal",
      labels: passthrough(applyStride(categories, stride)),
      stride,
      requiredExtentPx: 0,
      angleDeg: 0,
      maxTextWidthPx: 0,
    };
  }

  if (containerWidth > 0 && containerWidth < CATEGORY_AXIS_MIN_CONTAINER_WIDTH) {
    return HIDDEN;
  }

  const budget = maxExtent - CATEGORY_AXIS_PADDING;
  if (budget <= 0 || slotSize <= 0) {
    return HIDDEN;
  }

  const strideFloor = allowDrop ? countStride(categories.length, maxLabels) : 1;

  const attempt = (stride: number, canRecurse: boolean): CategoryAxisPlan => {
    const kept = applyStride(categories, stride);
    const effectiveSlot = slotSize * stride;
    const widths = kept.map((entry) => measure(entry.label));
    const maxTextWidthPx = widths.length > 0 ? Math.max(...widths) : 0;

    // --- "left": labels stay horizontal; the gutter WIDTH is the budget. ---
    if (placement === "left") {
      if (effectiveSlot < lineHeightPx) {
        if (allowDrop && canRecurse) {
          const next = Math.max(stride + 1, Math.ceil(lineHeightPx / slotSize));
          return attempt(next, false);
        }
        return HIDDEN;
      }
      if (budget < CATEGORY_AXIS_MIN_TEXT_PX) {
        return HIDDEN;
      }
      const run = densestUnambiguousRun(categories, stride, budget, measure, allowDrop);
      if (!run) {
        return HIDDEN;
      }
      const { labels } = run;
      const shown = labels.map((label) => measure(label.display));
      return {
        mode: "horizontal",
        labels,
        stride: run.stride,
        requiredExtentPx: Math.ceil(Math.max(...shown, 0)) + CATEGORY_AXIS_PADDING,
        angleDeg: 0,
        maxTextWidthPx,
      };
    }

    // --- "bottom": horizontal if the text fits its slot. ---
    if (maxTextWidthPx + CATEGORY_AXIS_LABEL_GAP <= effectiveSlot) {
      const extent = Math.ceil(lineHeightPx) + CATEGORY_AXIS_PADDING;
      if (extent <= maxExtent) {
        return {
          mode: "horizontal",
          labels: passthrough(kept),
          stride,
          requiredExtentPx: extent,
          angleDeg: 0,
          maxTextWidthPx,
        };
      }
    }

    // --- tilt, when the perpendicular spacing between baselines allows it. ---
    const tiltViable = effectiveSlot >= lineHeightPx * SQRT2;
    if (tiltViable) {
      const textBudget = tiltedTextBudget(budget, lineHeightPx);
      if (textBudget >= CATEGORY_AXIS_MIN_TEXT_PX) {
        const run = densestUnambiguousRun(categories, stride, textBudget, measure, allowDrop);
        if (!run) {
          return HIDDEN;
        }
        const { labels } = run;
        const shownMax = Math.max(...labels.map((label) => measure(label.display)), 0);
        return {
          mode: "tilted",
          labels,
          stride: run.stride,
          requiredExtentPx: Math.ceil(tiltedExtent(shownMax, lineHeightPx)) + CATEGORY_AXIS_PADDING,
          angleDeg: CATEGORY_AXIS_TILT_DEG,
          maxTextWidthPx,
        };
      }
    }

    // --- drop, then RE-ENTER ONCE: a wider slot may go back to horizontal. ---
    if (allowDrop && canRecurse) {
      const needed = Math.ceil((maxTextWidthPx + CATEGORY_AXIS_LABEL_GAP) / slotSize);
      const forTilt = Math.ceil((lineHeightPx * SQRT2) / slotSize);
      const next = Math.max(stride + 1, Math.min(needed, forTilt));
      if (next < categories.length) {
        return attempt(next, false);
      }
    }

    return HIDDEN;
  };

  return attempt(strideFloor, true);
}
