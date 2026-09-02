/**
 * The operating-mode and reasoning-effort vocabulary behind
 * `PromptInputMode`/`PromptInputEffort` (`@elabs-ai/components-ai`, #104/#107)
 * and the terminal CLI look-alike family's own composer chips (issue #117).
 *
 * Promoted here (not duplicated) because `@elabs-ai/components-ai` and
 * `@elabs-ai/components-terminal` are layer-2 DAG SIBLINGS and may not import
 * each other — `ui` is upstream of both
 * (docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4). Both
 * types are caller-supplied vocabulary objects — never a vendor union — which
 * #117 requires: no vendor mode/effort union may appear in a public type.
 */
import type { ReactNode } from "react";

/**
 * One app-defined operating mode — how autonomously the agent may act while
 * this mode is active. `brand-ui` ships no vocabulary: `id`/`label` are
 * entirely the consumer's (e.g. `"auto"`/`"Auto"`, `"plan"`/`"Plan first"`,
 * or a completely different product's own terms).
 */
export interface OperatingMode {
  /** Stable identifier — round-trips through `value`/`onValueChange`. */
  id: string;
  /** Visible + accessible name. */
  label: string;
  /** One line of guidance shown under the label in the menu. */
  description?: string;
  /** A shortcut hint rendered as a `Kbd` chip next to the label (e.g. `"⇧ Tab"`). */
  keyHint?: string;
  /** Leading glyph. Decorative — the mode is identified by `label`, not the icon. */
  icon?: ReactNode;
}

/**
 * One rung of an app-defined reasoning-effort scale. `brand-ui` ships no
 * vocabulary: `id`/`label` are entirely the consumer's (e.g.
 * `"low"`/`"Low"` … `"max"`/`"Max"`, or a completely different product's own
 * terms and however many rungs it wants).
 */
export interface EffortLevel {
  /** Stable identifier — round-trips through `value`/`onValueChange`. */
  id: string;
  /** Visible + accessible name for this rung. */
  label: string;
}

/**
 * Growing-square size rungs (Tailwind's own spacing scale — `size-2.5` through
 * `size-6`), indexed by ordinal position so a caller never invents a raw
 * pixel value. All in ONE `tailwind-merge` class group (`size`), so
 * overriding a base size class is a guaranteed, order-independent swap
 * rather than a `w-*`/`h-*` vs `size-*` conflict tailwind-merge can't see.
 */
const EFFORT_SIZE_RUNGS = [
  "size-2.5",
  "size-3",
  "size-3.5",
  "size-4",
  "size-4.5",
  "size-5",
  "size-5.5",
  "size-6",
] as const;

/**
 * The size class for rung `index` of `count` evenly-spaced rungs — the
 * growing-square ramp `PromptInputEffort` (and the terminal composer's own
 * effort chips) render, low to high.
 */
export function effortRungForIndex(
  index: number,
  count: number,
): (typeof EFFORT_SIZE_RUNGS)[number] {
  if (count <= 1) return EFFORT_SIZE_RUNGS[0];
  const position = index / (count - 1);
  const rungIndex = Math.min(
    EFFORT_SIZE_RUNGS.length - 1,
    Math.max(0, Math.round(position * (EFFORT_SIZE_RUNGS.length - 1))),
  );
  return EFFORT_SIZE_RUNGS[rungIndex] ?? EFFORT_SIZE_RUNGS[0];
}
