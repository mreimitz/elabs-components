"use client";

import type { ReactNode } from "react";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { useLocale } from "../locale-provider";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "../sidebar";

export interface NavUserUser {
  name: string;
  email: string;
  /** URL for the user's avatar image. */
  avatar?: string;
}

export interface NavUserProps {
  user: NavUserUser;
  /** Fires when "Settings" is chosen. Ignored when `settingsHref` is set. */
  onSettings?: () => void;
  /** Route of the settings screen — "Settings" renders as a link to it. */
  settingsHref?: string;
  /** Fires when "Sign out" is chosen. */
  onSignOut?: () => void;
  /**
   * Extra `DropdownMenuItem`s, placed above "Settings" (e.g. Profile, Billing).
   * Settings and Sign out are always present — they are the standard pair.
   */
  children?: ReactNode;
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * The standard sidebar footer: the signed-in user (avatar, name, email) as one
 * row that opens the account menu — Settings, then Sign out. EVERY app shell's
 * nav rail ends with this; settings never sits in the footer as a loose nav
 * row, and the footer carries no environment/meta line.
 *
 * Collapsed to the 48px icon rail the row is the avatar alone, and its
 * accessible name is written out because the visible label is gone.
 */
export function NavUser({ user, onSettings, settingsHref, onSignOut, children }: NavUserProps) {
  const { isMobile } = useSidebar();
  const { t } = useLocale();
  const initials = initialsOf(user.name);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={user.name}
              // Written out: collapsed, the trigger is only an avatar, so its
              // contents cannot name it. Same string as the visible label, in
              // reading order (WCAG 2.5.3).
              aria-label={`${user.name} ${user.email}`}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                {user.avatar && <AvatarImage src={user.avatar} alt="" />}
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-start text-body leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-meta text-sidebar-muted-foreground">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown
                aria-hidden="true"
                className="ms-auto size-4 group-data-[collapsible=icon]:hidden"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            data-slot="nav-user-menu"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-meta text-muted-foreground">
              {t("ui.navUser.label")}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {children}
              {settingsHref ? (
                <DropdownMenuItem asChild>
                  <a href={settingsHref}>
                    <Settings aria-hidden="true" />
                    {t("ui.navUser.settings")}
                  </a>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={onSettings}>
                  <Settings aria-hidden="true" />
                  {t("ui.navUser.settings")}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSignOut}>
              <LogOut aria-hidden="true" />
              {t("ui.navUser.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
