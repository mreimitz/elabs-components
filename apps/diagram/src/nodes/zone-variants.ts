import { cn } from "@elabs-ai/components-ui";
import type { ZoneKind, ZoneOwner } from "./zone-data";

/**
 * DG-06 — the zone boundary vocabulary as two visual axes, `owner` × `kind`.
 *
 * `owner` sets the fill and the border STYLE (customer solid on the muted surface, SaaS
 * solid on the raised card surface plus a hatch, hosted dotted, partner dashed); `kind`
 * sets the corner radius and the border WEIGHT. Colour comes only from `border-border-strong`
 * and the three surface fills — no per-owner or per-provider hue —
 * so every owner survives greyscale on border style + the owner word in the header.
 * Every owner's line takes the strong rung: the line is the ONLY cue around a zone. The
 * surface fills sit within 1.00–1.29:1 of each other and of the canvas (measured, light /
 * qlik-light / dark), so a nested zone with its parent's fill (customer ⊃ on-prem ⊃ subnet)
 * and a top-level zone on the canvas alike are told apart by the line alone (conventions,
 * "border vs border-strong"). Measured rung contrast: DG-06-zone-primitives.md, "Zone border
 * rung ≥3:1 vs nested fill".
 *
 * P4: library gap — this is a `cva` config written out as data. `class-variance-authority`
 * is not an app dependency (`apps/diagram/package.json` is outside DG-06's touches and the
 * item lists no install), and flow has no boundary `cva` to import. The object below has
 * `cva`'s exact shape, so adopting either is a mechanical swap:
 * `export const zoneVariants = cva(ZONE_VARIANTS.base, ZONE_VARIANTS)`.
 * See docs/findings/DG-06-zone-primitives.md, "Boundary variants".
 */
const ZONE_VARIANTS = {
  // Zones are regions, not raised cards: no resting shadow (FlowGroupNode does the same).
  base: "shadow-none",
  variants: {
    owner: {
      customer: "bg-surface-muted border-solid border-border-strong",
      saas: "bg-card border-solid border-border-strong",
      hosted: "bg-background border-dotted border-border-strong",
      partner: "bg-background border-dashed border-border-strong",
    } satisfies Record<ZoneOwner, string>,
    kind: {
      "cloud-account": "rounded-xl border-2",
      region: "rounded-lg border",
      vnet: "rounded-md border",
      subnet: "rounded border",
      cluster: "rounded-lg border",
      "on-prem": "rounded-none border-2",
      datacenter: "rounded-none border-2",
      "trust-boundary": "rounded-lg border-2",
      generic: "rounded-md border",
    } satisfies Record<ZoneKind, string>,
  },
  // Last, so a trust boundary's dashed strong line wins over every owner's style.
  compoundVariants: [
    {
      kind: "trust-boundary",
      className: "rounded-lg border-2 border-dashed border-border-strong",
    },
  ] satisfies { kind: ZoneKind; className: string }[],
  defaultVariants: { owner: "customer", kind: "generic" },
} as const;

export interface ZoneVariantProps {
  owner?: ZoneOwner | null;
  kind?: ZoneKind | null;
}

/** The zone frame's classes for one `owner` × `kind` (the `cva` call signature). */
export function zoneVariants({ owner, kind }: ZoneVariantProps = {}): string {
  const o = owner ?? ZONE_VARIANTS.defaultVariants.owner;
  const k = kind ?? ZONE_VARIANTS.defaultVariants.kind;
  return cn(
    ZONE_VARIANTS.base,
    ZONE_VARIANTS.variants.owner[o],
    ZONE_VARIANTS.variants.kind[k],
    ZONE_VARIANTS.compoundVariants.filter((c) => c.kind === k).map((c) => c.className),
  );
}

/**
 * The hatch for a SaaS zone: `bg-hairline-hatch` from the tokens (a faded diagonal hatch
 * on the element's own masked `::before` layer — tokens themes.css `@utility
 * bg-hairline-hatch`). It goes on the zone BODY, not the frame: `cn()`'s tailwind-merge
 * reads `bg-hairline-hatch` as a background COLOUR and drops the frame's `bg-card` fill
 * when both share one element. P4: library gap — `cn` has no class group for the texture
 * utilities (DG-06-zone-primitives.md, "Hatch vs fill in cn()").
 */
const ZONE_BODY_VARIANTS = {
  owner: {
    customer: "",
    saas: "bg-hairline-hatch",
    hosted: "",
    partner: "",
  } satisfies Record<ZoneOwner, string>,
} as const;

/** The zone body's classes for one `owner`. */
export function zoneBodyVariants({ owner }: Pick<ZoneVariantProps, "owner"> = {}): string {
  return ZONE_BODY_VARIANTS.owner[owner ?? ZONE_VARIANTS.defaultVariants.owner];
}
