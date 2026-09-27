import type { ComponentProps, ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@elabs-ai/components-ui";

export interface WithTooltipProps {
  /** The control's accessible name AND its tooltip text, from one string. */
  label: string;
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
export function WithTooltip({ label, children, side = "bottom" }: WithTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild aria-label={label}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
