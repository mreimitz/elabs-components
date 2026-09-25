import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { flowToneVariants, type FlowEmphasis, type FlowTone } from "../flow-tone";

export interface FlowNodeCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Status tone of the card's border and tone parts. @default "neutral" */
  tone?: FlowTone;
  /** `"featured"` gives a neutral card the primary border. @default "default" */
  emphasis?: FlowEmphasis;
  /** React Flow's `selected` for this node — paints the selection ring. */
  selected?: boolean;
}

/**
 * The painted card of a node — and the node's box. Build every custom node on it.
 *
 * It carries the three things a node owes the canvas, so a custom node gets them by
 * construction instead of by copying a class string:
 *
 * 1. **The card is the node box.** It is `relative`, so every `FlowPort`/`Handle`
 *    inside it is laid out against the card and its dot sits on the card's border.
 *    Extra rows go inside the card, never beside it. Never clip the card
 *    (`overflow-hidden`): ports and `NodeResizer` corners sit half outside it, so
 *    clipping hides them and makes them ungrabbable. Scroll an inner element instead.
 * 2. **Selection and focus are two signals.** `selected` paints a `ring-2 ring-ring`
 *    selection marker. Keyboard focus is separate: React Flow puts `tabIndex` and the
 *    real `:focus-visible` state on ITS wrapper (`.react-flow__node`, which carries
 *    `data-id`), one level above this card, so the indicator is the proxied flavour —
 *    `[[data-id]:focus-visible_&]:focus-ring-static` (ADR 0027). A node that is both
 *    selected and focused shows both layers.
 * 3. **One tone system.** `tone` and `emphasis` go through `flowToneVariants`, which
 *    paints the border and every `data-flow-tone-part` inside the card. Pair a
 *    non-neutral tone with `FlowToneIndicator` for the non-colour channel.
 *
 * `className` merges last, so a node can change padding, width, fill or border.
 */
export const FlowNodeCard = forwardRef<HTMLDivElement, FlowNodeCardProps>(function FlowNodeCard(
  { tone = "neutral", emphasis = "default", selected, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="flow-node-card"
      data-tone={tone}
      data-emphasis={emphasis}
      className={cn(
        "relative rounded-lg border border-border bg-flow-node text-flow-node-foreground shadow-sm",
        "transition-[box-shadow,border-color] duration-fast ease-standard",
        flowToneVariants({ tone, emphasis }),
        selected && "ring-2 ring-ring",
        "[[data-id]:focus-visible_&]:focus-ring-static",
        className,
      )}
      {...props}
    />
  );
});
