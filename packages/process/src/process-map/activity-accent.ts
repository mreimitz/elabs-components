/**
 * How an activity's identity colour is painted (RM-054).
 *
 * The ONE place that turns an {@link ActivityColor} into CSS, shared by
 * `ProcessActivityNode`'s accent swatch and `VariantExplorer`'s sequence chips — so the
 * two views cannot drift into painting the same activity differently. Both endpoints are
 * semantic tokens; no literal colour is authored.
 *
 * The shared "other" bucket is a diagonal hatch over a light wash of the same token, so
 * it reads as "one of many" in greyscale too, never as a twelfth distinct activity.
 */
import type { CSSProperties } from "react";
import type { ActivityColor } from "../core/activity-color-scale";

/** Inline style for an accent swatch painted with `color`. */
export function activityAccentStyle(color: ActivityColor): CSSProperties {
  const ink = `var(${color.token})`;
  if (color.pattern === "other") {
    return {
      backgroundColor: `color-mix(in oklab, ${ink} 30%, transparent)`,
      backgroundImage: `repeating-linear-gradient(135deg, ${ink} 0 1.5px, transparent 1.5px 3.5px)`,
    };
  }
  return { backgroundColor: ink };
}
