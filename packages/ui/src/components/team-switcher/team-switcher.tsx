"use client";

import * as React from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "../sidebar";
import { useLocale } from "../locale-provider";
import { cn } from "../../lib/cn";

export type TeamSwitcherTeam = {
  name: string;
  logo: React.ElementType;
  plan: string;
};

export interface TeamSwitcherProps {
  teams: TeamSwitcherTeam[];
  /**
   * Tailwind class for the active-team logo container background.
   * @default "bg-sidebar-accent text-sidebar-accent-foreground"
   */
  logoClassName?: string;
  className?: string;
}

/**
 * Sidebar team/workspace switcher. Shared primitive reconciled from sidebar-02
 * and sidebar-05 blocks (issue #99). Copy-owned blocks should import this
 * instead of maintaining local duplicates.
 */
export function TeamSwitcher({ teams, logoClassName, className }: TeamSwitcherProps) {
  const { isMobile } = useSidebar();
  const { t } = useLocale();
  const [activeTeam, setActiveTeam] = React.useState(teams[0]);
  if (!activeTeam) return null;
  const Logo = activeTeam.logo;

  return (
    <SidebarMenu className={className}>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              // The name is written out rather than left to the button's own
              // contents, because the contents cannot carry it in every state:
              // collapsed to the 48px rail the trigger is one glyph, and the
              // label beside it is either gone or clipped out of view by the
              // button's `overflow-hidden` — either way axe reads a nameless
              // button (`button-name`, critical). The string is exactly the
              // visible label, in reading order, so WCAG 2.5.3 (label in name)
              // holds expanded, where that label IS on screen. Verified by
              // deleting this line and watching three dashboard stories fail
              // `button-name` (critical).
              aria-label={`${activeTeam.name} ${activeTeam.plan}`}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {/* Collapsed, this row is ONE ICON in a 48px rail and has to sit
                  on the same centre line as every nav entry above and below it.
                  Measured before this fix: the 32px plate did not fit the
                  button's 16px content box, so it overflowed (clipped by the
                  button's own `overflow-hidden`) and its glyph landed 8px to the
                  trailing side of every other icon in the rail. So the plate
                  becomes the glyph's own 16px box — no fill, no radius, nothing
                  to overflow — and the label and chevron stand down: at 48px
                  there is no room to read them, and they are what crowds the
                  plate. Expanded, all three come back unchanged. */}
              <div
                className={cn(
                  "flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg",
                  logoClassName ?? "bg-sidebar-accent text-sidebar-accent-foreground",
                  "group-data-[collapsible=icon]:size-4 group-data-[collapsible=icon]:rounded-none group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:text-sidebar-foreground",
                )}
              >
                <Logo className="size-4" />
              </div>
              <div className="grid flex-1 text-start text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">{activeTeam.name}</span>
                <span className="truncate text-xs">{activeTeam.plan}</span>
              </div>
              {/* Decorative, so it simply goes. */}
              <ChevronsUpDown className="ms-auto group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t("ui.teamSwitcher.label")}
            </DropdownMenuLabel>
            {teams.map((team, index) => (
              <DropdownMenuItem
                key={team.name}
                onClick={() => setActiveTeam(team)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <team.logo className="size-4 shrink-0" />
                </div>
                {team.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">
                {t("ui.teamSwitcher.addTeam")}
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
