import { cva, type VariantProps } from "class-variance-authority";
import type { ArchMarkedKind, ArchNodeVariant } from "./arch-node-data";

/**
 * DG-05 — the architecture node box as two visual axes, `variant` × `kind`. It goes on
 * `FlowNodeCard`'s `className`, which merges last, so it can drop the card's border, fill
 * and shadow for the `icon` look. Tone and emphasis are NOT here: they come from
 * `FlowNodeCard`'s own `flowToneVariants` (border + `data-flow-tone-part` parts). So this
 * config never sets a whole-border colour — it would override the tone border.
 *
 * - `variant: icon` — the AWS/Azure reference-architecture look: a 40 px mark with the
 *   label under it, no box (no border, fill or shadow), 128 px wide.
 * - `variant: card` — the C4 look: a 240 px card with eyebrow, title, subtitle, badges.
 * - `kind` adds the shape cue. `external` is dashed (and in the `icon` look gets a 1 px
 *   outline so the dash shows at all); `datastore` rounds the bottom (a cylinder cue);
 *   `queue` is a pill in `icon` and a left rail in `card`; `actor` puts its mark on a
 *   circle drawn in the mark's own colour (`border-current`, so it follows the tone the
 *   way the glyph does), reaching the mark through its `data-slot` the way
 *   `flowToneVariants` reaches `data-flow-tone-part`s, so one config styles the node).
 *
 * `class-variance-authority` is an app dependency since 2026-09-26 (maintainer decision,
 * plan §11); callers merge the result through `cn()` (FlowNodeCard's `className`), so a
 * compound variant's classes win over the axis classes they conflict with.
 */
export const archNodeVariants = cva("flex flex-col", {
  variants: {
    variant: {
      // P4: library gap — the `icon` look un-paints `FlowNodeCard` (border, fill, shadow)
      // through `className`; a `FlowNodeCard` `variant="bare"` would own this look.
      icon: "w-32 items-center gap-1 border-0 bg-transparent p-2 text-center shadow-none",
      card: "w-60 gap-2 p-3",
    } satisfies Record<ArchNodeVariant, string>,
    kind: {
      service: "",
      actor:
        "**:data-[slot=arch-mark]:rounded-full **:data-[slot=arch-mark]:border-2 **:data-[slot=arch-mark]:border-current **:data-[slot=arch-mark]:p-1",
      datastore: "rounded-b-xl",
      queue: "",
      // P4: library gap — a dashed line reads a rung lighter, so a NEUTRAL dashed frame
      // wants `border-border-strong`; but any border colour here would override the tone
      // border `flowToneVariants` paints. It stays `border-border` (1.44:1 on white).
      external: "border-dashed",
    } satisfies Record<ArchMarkedKind, string>,
  },
  compoundVariants: [
    { variant: "icon", kind: "queue", className: "rounded-full" },
    // P4: library gap — the item asks for a STRIPED rail; no stripe/hatch border token
    // exists, so the rail is the nearest token: a solid `border-s-4 border-s-border-strong`.
    { variant: "card", kind: "queue", className: "border-s-4 border-s-border-strong" },
    // The `icon` look has no border, so `border-dashed` alone would draw nothing.
    { variant: "icon", kind: "external", className: "border" },
  ],
  defaultVariants: { variant: "icon", kind: "service" },
});

export type ArchNodeVariantProps = VariantProps<typeof archNodeVariants>;
