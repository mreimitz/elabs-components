/**
 * Status on a plan — free desk, busy machine, line in alarm — without leaning on
 * colour (WCAG 1.4.1).
 *
 * The MapLibre style spec decides how the channels split, and the split is not a
 * matter of taste: `fill-pattern` and `line-dasharray` accept `zoom` and
 * `feature` expressions but **not `feature-state`**, while `fill-color`,
 * `fill-opacity`, `line-color` and `line-width` accept all three. So:
 *
 * - **status** rides feature PROPERTIES — pattern and dash, which cannot read
 *   feature-state anyway;
 * - **hover and selection** ride feature STATE — opacity, width and colour.
 *
 * The two can therefore never collide, and selection must never be expressed as
 * a dash change: a selected free room would read as an occupied one.
 *
 * In greyscale each status still differs by four textures, four outline styles
 * and, on the two states that must never be confused, a glyph — with the legend
 * and the table repeating all of it as words.
 */
import { STATUS_TONE_ICONS } from "@elabs-ai/components-ui";
import type { LucideIcon } from "lucide-react";

/** What a region on a plan can be. */
export type PlanStatus = "free" | "occupied" | "warning" | "down";

/** Every {@link PlanStatus}, in legend order. */
export const PLAN_STATUSES: readonly PlanStatus[] = ["free", "occupied", "warning", "down"];

/** The generated hatch tile a status is textured with — see `lib/plan-patterns.ts`. */
export type PlanPatternKind = "none" | "diagonal" | "cross" | "dense";

/** The outline style a status is drawn with: the second non-colour channel. */
export type PlanDash = "solid" | "dotted" | "dashed" | "dot-dash";

/** MapLibre `line-dasharray` values, in line widths. `undefined` means solid. */
const DASH_ARRAYS: Record<PlanDash, number[] | undefined> = {
  solid: undefined,
  dotted: [1, 1.5],
  dashed: [3, 2],
  "dot-dash": [4, 1.5, 1, 1.5],
};

export interface PlanStatusEncoding {
  /** The status tone, for the token rungs below. */
  tone: "success" | "neutral" | "warning" | "destructive";
  /** The hatch tile registered with `map.addImage`. */
  pattern: PlanPatternKind;
  /** The outline style. */
  dash: PlanDash;
  /** `line-dasharray` for the outline; `undefined` keeps it solid. */
  dashArray: number[] | undefined;
  /**
   * A glyph, on the two states that must never be confused with a working one.
   * `undefined` elsewhere: a glyph on every neutral region is noise.
   */
  icon: LucideIcon | undefined;
  /** Stable glyph name, so a test can assert the four states read apart. */
  glyph: "none" | "clock" | "alert";
  /** The token the shape's own ink resolves from (the ≥3:1 mark rung). */
  colorToken: string;
  /** Mark (fill-rung) utility, for a legend swatch. */
  markClass: string;
  /** Ink (`-text` rung) utility, for coloured text on an ordinary surface. */
  textClass: string;
}

/**
 * The one table every plan surface reads status from — map paint, legend, table
 * and readout alike. Frozen, so a surface cannot quietly drift from the others.
 */
export const PLAN_STATUS_ENCODING: Readonly<Record<PlanStatus, PlanStatusEncoding>> = Object.freeze(
  {
    free: {
      tone: "success",
      pattern: "none",
      dash: "solid",
      dashArray: DASH_ARRAYS.solid,
      icon: undefined,
      glyph: "none",
      colorToken: "--success",
      markClass: "bg-success",
      textClass: "text-success-text",
    },
    occupied: {
      tone: "neutral",
      pattern: "diagonal",
      dash: "dotted",
      dashArray: DASH_ARRAYS.dotted,
      icon: undefined,
      glyph: "none",
      colorToken: "--muted-foreground",
      markClass: "bg-muted-foreground",
      textClass: "text-muted-foreground",
    },
    warning: {
      tone: "warning",
      pattern: "cross",
      dash: "dashed",
      dashArray: DASH_ARRAYS.dashed,
      icon: STATUS_TONE_ICONS.warning,
      glyph: "clock",
      colorToken: "--warning",
      markClass: "bg-warning",
      textClass: "text-warning-text",
    },
    down: {
      tone: "destructive",
      pattern: "dense",
      dash: "dot-dash",
      dashArray: DASH_ARRAYS["dot-dash"],
      icon: STATUS_TONE_ICONS.destructive,
      glyph: "alert",
      colorToken: "--destructive",
      markClass: "bg-destructive",
      textClass: "text-destructive-text",
    },
  },
);

/** Fill opacity per interaction state — the feature-state channel, in one place. */
export const PLAN_FILL_OPACITY = Object.freeze({
  rest: 0.16,
  hover: 0.28,
  selected: 0.36,
});

/**
 * A MapLibre `match` expression over a status property, so one paint value can
 * serve every status without a layer per status.
 *
 * ```ts
 * "line-dasharray": planStatusMatch("status", (encoding) => encoding.dashArray ?? [1, 0])
 * ```
 */
export function planStatusMatch<T>(
  property: string,
  value: (encoding: PlanStatusEncoding, status: PlanStatus) => T,
  fallback?: T,
): unknown[] {
  const expression: unknown[] = ["match", ["get", property]];
  for (const status of PLAN_STATUSES) {
    expression.push(status, value(PLAN_STATUS_ENCODING[status], status));
  }
  expression.push(fallback ?? value(PLAN_STATUS_ENCODING.occupied, "occupied"));
  return expression;
}
