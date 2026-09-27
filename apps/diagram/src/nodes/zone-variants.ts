import { cva, type VariantProps } from "class-variance-authority";
import type { ZoneKind, ZoneOwner } from "./zone-data";

/**
 * DG-06 — the zone boundary vocabulary, reworked by DG-20 (the Atlas bar) into four visual
 * axes, each writing to its own channel:
 *
 * - `owner` — the border STYLE: customer and SaaS solid, hosted dotted, partner dashed. The
 *   dotted and dashed lines take the strong rung (a broken line on the quiet rung vanishes);
 *   the solid ones take the quiet `border-border` rung, because their fill carries the edge
 *   (below). Customer vs SaaS in greyscale: customer sits one fill rung down (`bg-surface-muted`),
 *   SaaS on the raised card with the hatch (`zoneBodyVariants`), and the owner word rides in
 *   the corner label chip.
 * - `kind` — the corner radius, all 1 px (DG-20 defect 3: 2 px frames out-shouted the content).
 *   A trust boundary is the exception the brief names: a 2 px dashed strong line plus the
 *   Shield in the label chip. Its weight and glyph tell it from a partner zone's 1 px dash
 *   (wave-1 review M8), and the owner word still names its owner.
 * - `fill` — the elevation rung by nesting level (`zoneFill`): canvas → muted → raised, one
 *   rung lighter per level (DG-20 defect 4).
 * - `capped` — past the last fill rung a nested zone repeats its parent's fill, so its line is
 *   the ONLY cue left and takes the strong rung (conventions, "border vs border-strong").
 *
 * No per-owner or per-provider hue: colour comes only from the border rungs and the three
 * surface fills. `zone-node.tsx` merges the result through `cn()`.
 */
// Zones are regions, not raised cards: no resting shadow (FlowGroupNode does the same).
export const zoneVariants = cva("shadow-none", {
  variants: {
    owner: {
      customer: "border-solid border-border",
      saas: "border-solid border-border",
      hosted: "border-dotted border-border-strong",
      partner: "border-dashed border-border-strong",
    } satisfies Record<ZoneOwner, string>,
    kind: {
      "cloud-account": "rounded-xl border",
      region: "rounded-lg border",
      vnet: "rounded-md border",
      subnet: "rounded border",
      cluster: "rounded-lg border",
      "on-prem": "rounded-none border",
      datacenter: "rounded-none border",
      "trust-boundary": "rounded-lg border-2 border-dashed border-border-strong",
      generic: "rounded-md border",
    } satisfies Record<ZoneKind, string>,
    fill: {
      canvas: "bg-background",
      muted: "bg-surface-muted",
      raised: "bg-card",
    },
    capped: {
      true: "border-border-strong",
      false: "",
    },
  },
  defaultVariants: { owner: "customer", kind: "generic", fill: "canvas", capped: false },
});

export type ZoneVariantProps = VariantProps<typeof zoneVariants>;
export type ZoneFill = NonNullable<ZoneVariantProps["fill"]>;

/**
 * Where each root owner starts on the fill ladder: a customer estate one rung down (the faint
 * tint), SaaS on the raised card (under its hatch), hosted and partner on the canvas (their
 * broken strong line is the cue).
 */
const ROOT_LEVEL: Record<ZoneOwner, number> = { customer: 1, saas: 2, hosted: 0, partner: 0 };
const FILL_LADDER: readonly ZoneFill[] = ["canvas", "muted", "raised"];

/**
 * The fill rung for a zone `depth` levels below a top-level zone owned by `rootOwner`, and
 * whether it is capped (past the last rung, so the line must carry the edge alone).
 */
export function zoneFill(depth: number, rootOwner: ZoneOwner): { fill: ZoneFill; capped: boolean } {
  const level = depth + ROOT_LEVEL[rootOwner];
  const last = FILL_LADDER.length - 1;
  return { fill: FILL_LADDER[Math.min(level, last)] ?? "canvas", capped: level > last };
}

/**
 * The hatch for a SaaS zone: `bg-hairline-hatch` from the tokens (a faded diagonal hatch
 * on the element's own masked `::before` layer — tokens themes.css `@utility
 * bg-hairline-hatch`). It goes on the zone BODY, not the frame: `cn()`'s tailwind-merge
 * reads `bg-hairline-hatch` as a background COLOUR and drops the frame's fill when both
 * share one element. P4: library gap — `cn` has no class group for the texture utilities
 * (DG-06-zone-primitives.md, "Hatch vs fill in cn()").
 */
export const zoneBodyVariants = cva("", {
  variants: {
    owner: {
      customer: "",
      saas: "bg-hairline-hatch",
      hosted: "",
      partner: "",
    } satisfies Record<ZoneOwner, string>,
  },
  defaultVariants: { owner: "customer" },
});
