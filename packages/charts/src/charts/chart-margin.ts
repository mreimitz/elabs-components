/**
 * chart-margin.ts — the pixel margin every chart shell resolves to (RM-173).
 *
 * Split out of `chart-context.tsx`, which also imports React and `motion`, so
 * the future `frame-size` prop group (ADR 0042 §4) can reference `Margin`
 * without pulling either into the pure definition layer. `chart-context.tsx`
 * re-exports it, so every existing import keeps working unchanged.
 */
import type { CSSProperties } from "react";

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// RM-183 — the radial/part-to-whole families (`PieChart`, `RingChart`,
// `FunnelChart`, `UnitChart`, `BulletChart`) adopt the shared `frame-size`
// group's `margin?: number | Partial<Margin>` shape (`charts/props/frame-size.ts`),
// which none of them had before. One tiny resolver, appended here rather than
// duplicated five times, turns that union into a full `Margin` against a
// family-supplied fallback (every one of these families' own default is "no
// extra margin" — `ZERO_MARGIN` — so an unset `margin` prop is byte-identical
// to today). Named/shaped to match the cartesian families' own
// `resolveChartMargin` (RM-182, `chart-margin.ts`'s sibling wave) so the two
// waves never drift into two resolvers doing the same thing.
export const ZERO_MARGIN: Margin = { top: 0, right: 0, bottom: 0, left: 0 };

/** `number | Partial<Margin>` → a full `Margin`, against `fallback` (RM-182/RM-183). */
export function resolveChartMargin(
  margin: number | Partial<Margin> | undefined,
  fallback: Readonly<Margin>,
): Margin {
  if (typeof margin === "number") {
    return { top: margin, right: margin, bottom: margin, left: margin };
  }
  return { ...fallback, ...margin };
}

/**
 * `margin` as CSS `padding` on a normal-flow box (Pie/Ring's centred grid,
 * measured by `ParentSize`/a fixed `width`/`height`): shrinks the content box
 * by exactly `margin`, so nothing downstream needs its own offset math.
 * `undefined` at `ZERO_MARGIN` — no `style` prop added at all, so a chart with
 * `margin` unset renders byte-identical markup to before this prop existed.
 */
export function marginPaddingStyle(margin: Margin): CSSProperties | undefined {
  if (margin.top === 0 && margin.right === 0 && margin.bottom === 0 && margin.left === 0) {
    return undefined;
  }
  return { padding: `${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px` };
}

/**
 * `margin` as explicit `inset` overrides on an `absolute inset-0` layer
 * (Funnel/Unit's mark layers): CSS `padding` on their POSITIONED ANCESTOR has
 * no effect on an `inset-0` descendant (inset is measured from the padding
 * edge, not the content edge), so margin there is a per-side override of the
 * Tailwind `inset-0` instead. `undefined` at `ZERO_MARGIN`, so the inline
 * style is entirely absent — not even `top: 0px` — at the default.
 */
export function marginInsetStyle(margin: Margin): CSSProperties | undefined {
  if (margin.top === 0 && margin.right === 0 && margin.bottom === 0 && margin.left === 0) {
    return undefined;
  }
  return { top: margin.top, right: margin.right, bottom: margin.bottom, left: margin.left };
}
