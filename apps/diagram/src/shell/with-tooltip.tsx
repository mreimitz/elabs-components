import type { ComponentProps, ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@elabs-ai/components-ui";

export interface WithTooltipProps {
  /** The control's accessible name AND its tooltip's main line, from one string. */
  label: string;
  /**
   * An extra tooltip-only line under `label` (e.g. why the control is disabled right now) —
   * never part of the accessible name, so `aria-label` stays `label` alone.
   */
  description?: string;
  /** One control that renders a DOM element and forwards its ref and props. */
  children: ReactElement;
  side?: ComponentProps<typeof TooltipContent>["side"];
}

/**
 * Names an icon-only control that `IconButton` cannot be — a toggle-group item, a pressed
 * `Toggle`, a menu trigger, the theme switcher — by its tooltip. The trigger passes
 * `aria-label` down, so the name and the tooltip cannot drift apart. Needs a
 * `TooltipProvider` above it (the top bar mounts one).
 *
 * P4: library gap — `IconButton` has no `asChild` and no pressed look, `ToggleGroupItem`
 * has no `label`/tooltip for an icon-only item, and `ThemeSwitcher`'s menu forms have no
 * tooltip; each composes `Tooltip` itself here.
 */
export function WithTooltip({ label, description, children, side = "bottom" }: WithTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild aria-label={label}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>
        {label}
        {description ? <span className="block text-background/70">{description}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
