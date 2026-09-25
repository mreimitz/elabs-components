"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { Info, Star, type LucideIcon } from "lucide-react";
import { STATUS_TONE_ICONS } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useFlowMessage, type FlowMessageKey } from "../lib/flow-messages";
import { flowToneVariants, type FlowEmphasis, type FlowTone } from "./flow-tone";

/**
 * The glyph each non-neutral tone draws. `success`/`warning`/`destructive` reuse
 * `STATUS_TONE_ICONS`, the glyph `StatusBadge`/`StatusIcon` already pair with that tone,
 * rather than inventing a second icon vocabulary. `info` has no entry there yet, so it
 * takes Lucide's `Info` until the shared map grows one. `neutral` draws nothing: a glyph
 * on every ordinary node would be noise on the common case.
 */
const TONE_ICON: Partial<Record<FlowTone, LucideIcon>> = {
  info: STATUS_TONE_ICONS.info ?? Info,
  success: STATUS_TONE_ICONS.success,
  warning: STATUS_TONE_ICONS.warning,
  destructive: STATUS_TONE_ICONS.destructive,
};

const TONE_NAME: Partial<Record<FlowTone, FlowMessageKey>> = {
  info: "flow.tone.info",
  success: "flow.tone.success",
  warning: "flow.tone.warning",
  destructive: "flow.tone.destructive",
};

export interface FlowToneIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  /** The status tone to name. @default "neutral" (draws nothing) */
  tone?: FlowTone;
  /** `"featured"` adds the star. @default "default" */
  emphasis?: FlowEmphasis;
}

/**
 * The non-colour channel for a node's tone and emphasis: a star for `featured`, the
 * status glyph for a non-neutral tone, and an `sr-only` name for both — so a tone is
 * never carried by colour alone (WCAG 1.4.1). Renders nothing for a neutral, default
 * node.
 *
 * It colours itself through `flowToneVariants`, so it reads correctly on its own as well
 * as inside a `FlowNodeCard`. Custom nodes use it exactly as `FlowNode` does.
 */
export const FlowToneIndicator = forwardRef<HTMLSpanElement, FlowToneIndicatorProps>(
  function FlowToneIndicator({ tone = "neutral", emphasis = "default", className, ...props }, ref) {
    const msg = useFlowMessage();
    const ToneIcon = TONE_ICON[tone];
    const toneName = TONE_NAME[tone];
    const featured = emphasis === "featured";
    if (!ToneIcon && !featured) return null;

    const names = [
      featured ? msg("flow.emphasis.featured") : null,
      toneName ? msg(toneName) : null,
    ].filter(Boolean);

    return (
      <span
        ref={ref}
        data-slot="flow-tone-indicator"
        className={cn(
          "inline-flex shrink-0 items-center gap-1",
          flowToneVariants({ tone, emphasis }),
          className,
        )}
        {...props}
      >
        {featured ? (
          <Star aria-hidden="true" data-flow-tone-part="emphasis" className="size-3.5" />
        ) : null}
        {ToneIcon ? (
          <ToneIcon aria-hidden="true" data-flow-tone-part="ink" className="size-3.5" />
        ) : null}
        <span className="sr-only">{names.join(", ")}</span>
      </span>
    );
  },
);
