import { cva, type VariantProps } from "class-variance-authority";
import { MOTION_CLASS } from "../motion";
import type { ArchMarkedKind, ArchNodeVariant } from "./arch-node-data";

/**
 * DG-20 — the two node states the live-ops items (DG-30/31/33) will drive, prepared here:
 *
 * - `data-glow` on the node wrapper → a `shadow-ring-md` halo in `--ring`. The halo IS the
 *   edge while it shows, so the resting border goes transparent (never `border` beside
 *   `shadow-ring-*`).
 * - `data-dimmed` (DG-18 sets it) → the surface loses its lift. The mark's own fade and the
 *   text's muted ink come from DG-18's `DIM_CLASS` (use-canvas-interaction.ts), which keeps
 *   text at full opacity for contrast; a second opacity here would stack on the mark's.
 *
 * Both animate on the token motion scale (`MOTION_CLASS`, motion.ts).
 */
const NODE_STATES = [
  "transition-[box-shadow,border-color]",
  MOTION_CLASS.fast,
  "[[data-glow]_&]:border-transparent [[data-glow]_&]:shadow-ring-md [[data-glow]_&]:[--shadow-ring-color:var(--ring)]",
  "[[data-dimmed]_&]:shadow-none",
].join(" ");

/**
 * DG-05 — the architecture node box as two visual axes, `variant` × `kind`. It goes on
 * `FlowNodeCard`'s `className`, which merges last, so it can drop the card's border, fill
 * and shadow for the `icon` look. Tone and emphasis are NOT here: they come from
 * `FlowNodeCard`'s own `flowToneVariants` (border + `data-flow-tone-part` parts). So this
 * config never sets a whole-border colour on the card — it would override the tone border.
 *
 * - `variant: icon` — the reference-architecture look, reworked by DG-20: the mark sits on a
 *   common 48 px `bg-card` tile (`archTileVariants`), label and subtitle under it, and the
 *   node box itself stays bare (no border, fill or shadow), 128 px wide.
 * - `variant: card` — the C4 look: a 240 px card with eyebrow, title, subtitle, badges; it
 *   rests on `shadow-xs` and rises to `shadow-sm` on hover (DG-20).
 * - `kind` — the shape cue. In the `icon` look it lives on the TILE (`archTileVariants`), so
 *   the node box has no kind classes there (DG-20 defects 7 and 15: outlines round the mark
 *   read as selection, and the external's dashed box read as another drawing style). In the
 *   `card` look `external` is dashed, `datastore` rounds the card's bottom (a cylinder cue)
 *   and `queue` gets a left rail.
 *
 * `class-variance-authority` is an app dependency since 2026-09-26 (maintainer decision,
 * plan §11); callers merge the result through `cn()` (FlowNodeCard's `className`), so a
 * compound variant's classes win over the axis classes they conflict with.
 */
export const archNodeVariants = cva("group/arch-node flex flex-col", {
  variants: {
    variant: {
      // P4: library gap — the `icon` look un-paints `FlowNodeCard` (border, fill, shadow)
      // through `className`; a `FlowNodeCard` `variant="bare"` would own this look.
      icon: "w-32 items-center gap-1 border-0 bg-transparent p-2 text-center shadow-none",
      card: `w-60 gap-2 p-3 shadow-xs hover:shadow-sm ${NODE_STATES}`,
    } satisfies Record<ArchNodeVariant, string>,
    kind: {
      service: "",
      actor: "",
      datastore: "",
      queue: "",
      external: "",
    } satisfies Record<ArchMarkedKind, string>,
  },
  compoundVariants: [
    { variant: "card", kind: "datastore", className: "rounded-b-xl" },
    // P4: library gap — the item asks for a STRIPED rail; no stripe/hatch border token
    // exists, so the rail is the nearest token: a solid `border-s-4 border-s-border-strong`.
    { variant: "card", kind: "queue", className: "border-s-4 border-s-border-strong" },
    // P4: library gap — a dashed line reads a rung lighter, so a NEUTRAL dashed frame
    // wants `border-border-strong`; but any border colour here would override the tone
    // border `flowToneVariants` paints. It stays `border-border` (1.44:1 on white).
    { variant: "card", kind: "external", className: "border-dashed" },
  ],
  defaultVariants: { variant: "icon", kind: "service" },
});

export type ArchNodeVariantProps = VariantProps<typeof archNodeVariants>;

/**
 * DG-20 — the `icon` look's tile: one common raised ground (`bg-card`, `shadow-xs`) under
 * every mark, so coloured vendor tiles, bare line glyphs and full-bleed logos read as one
 * family (defect 6). It rises to `shadow-sm` when the node is hovered, and carries the
 * kind's SHAPE cue in greyscale: actor a circle, datastore a rounded-bottom box (the
 * cylinder), queue a pill, external a dashed strong outline.
 */
export const archTileVariants = cva(
  `relative flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-xs group-hover/arch-node:shadow-sm ${NODE_STATES}`,
  {
    variants: {
      kind: {
        service: "",
        actor: "rounded-full",
        datastore: "rounded-t-md rounded-b-2xl",
        queue: "w-16 rounded-full",
        external: "border-dashed border-border-strong",
      } satisfies Record<ArchMarkedKind, string>,
    },
    defaultVariants: { kind: "service" },
  },
);

export type ArchTileVariantProps = VariantProps<typeof archTileVariants>;
