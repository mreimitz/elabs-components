/**
 * The permanent 56px area rail — the outer half of the dual-rail shell.
 *
 * Deliberately NOT a `Sidebar`. `Sidebar` swaps itself for a `Sheet` below
 * 768px (`useIsMobile`), which is right for a rail you can put away and wrong
 * for the ONE strip that is always the way back into every other area: on a
 * phone it would vanish behind the same trigger it is supposed to sit beside,
 * and a closed sheet cannot be the thing you reopen it from. So the rail is a
 * plain flex column that exists at every width, built from the same
 * `SidebarMenu`/`SidebarMenuItem`/`SidebarMenuButton` parts the library's own
 * `ContextRail` uses for its 48px strip (`context-rail.tsx`,
 * `ContextRailNarrow`) — the precedent for chrome-grounded menu buttons living
 * outside a `Sidebar` but inside its provider.
 *
 * Two things follow from that provider requirement, and both are load-bearing:
 * `SidebarMenuButton` calls `useSidebar()` unconditionally, and it reads
 * `TooltipProvider` from `SidebarProvider` — so this component must be rendered
 * INSIDE the shell's one `SidebarProvider`, never beside it.
 *
 * The tooltips are written out rather than passed as `SidebarMenuButton`'s
 * `tooltip` prop: that prop renders `hidden={state !== "collapsed" || isMobile}`,
 * i.e. only while the provider's sidebar is collapsed. This rail is icon-only in
 * EVERY state, so its labels have to show in every state too.
 */
"use client";

import type { ComponentProps } from "react";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import {
  cn,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@elabs-ai/components-ui";
import { SETTINGS_AREAS, type SettingsArea } from "./nav-items";

export interface SettingsIconRailProps extends ComponentProps<"div"> {
  /** Areas to render, top to bottom. @default SETTINGS_AREAS */
  areas?: SettingsArea[];
  /** The area the second panel is currently listing. */
  currentAreaId: string;
  /** Whether the second panel is open — drives `aria-expanded` on each button. */
  panelOpen: boolean;
  /**
   * Clicking an area. The shell decides what that means (show this area and
   * open the panel; re-clicking the current one closes it) — the rail only
   * reports the click, so the switcher semantics live in one place.
   */
  onAreaSelect: (areaId: string) => void;
  /** Route out of settings, back into the app. @default "/" */
  exitHref?: string;
}

export function SettingsIconRail({
  areas = SETTINGS_AREAS,
  currentAreaId,
  panelOpen,
  onAreaSelect,
  exitHref = "/",
  className,
  ...props
}: SettingsIconRailProps) {
  return (
    <div
      data-slot="settings-icon-rail"
      className={cn(
        // `h-svh shrink-0`: the rail is a flex sibling of the panel and the
        // content pane, and it is the one column that must never give up width.
        "flex h-svh w-14 shrink-0 flex-col items-center gap-2 bg-sidebar py-2 text-sidebar-foreground",
        className,
      )}
      {...props}
    >
      {/* Decorative: the word "Settings" is already the page's heading and the
          first breadcrumb, so a second announcement here is noise. */}
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-primary"
      >
        <SlidersHorizontal className="size-5" />
      </span>

      <nav aria-label="Settings areas" className="flex min-h-0 flex-1 flex-col">
        <SidebarMenu className="gap-1">
          {areas.map((area) => {
            const Icon = area.icon;
            const isCurrent = area.id === currentAreaId;
            return (
              <SidebarMenuItem key={area.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      // 44px square at every width. The rail has no expanded
                      // state to fall back on, so the touch floor is not
                      // `pointer-coarse`-conditional here the way a top-bar
                      // trigger's is — this IS the control's only size.
                      className="size-11 justify-center p-0"
                      isActive={isCurrent}
                      aria-current={isCurrent ? "true" : undefined}
                      // The button opens/closes the section panel, so the
                      // disclosure state is real. No `aria-controls`: below
                      // `md` the panel is an unmounted `Sheet`, and an
                      // `aria-controls` pointing at an id that is not in the
                      // document is an axe `aria-valid-attr-value` failure.
                      aria-expanded={isCurrent && panelOpen}
                      onClick={() => onAreaSelect(area.id)}
                    >
                      <Icon aria-hidden="true" />
                      {/* The accessible name. The tooltip is a hover/focus
                          affordance, not a name — a control whose only text is
                          in a tooltip announces as "button". */}
                      <span className="sr-only">{area.label}</span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">{area.label}</TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </nav>

      <SidebarMenu className="shrink-0">
        <SidebarMenuItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuButton asChild className="size-11 justify-center p-0">
                <a href={exitHref}>
                  <ArrowLeft aria-hidden="true" />
                  <span className="sr-only">Leave settings</span>
                </a>
              </SidebarMenuButton>
            </TooltipTrigger>
            <TooltipContent side="right">Leave settings</TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
}
