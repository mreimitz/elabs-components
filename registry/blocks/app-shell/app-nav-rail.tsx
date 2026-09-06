/**
 * The flagship shell's nav rail — a collapsible-icon `Sidebar` wired to the
 * router-agnostic `NAV_GROUPS`/`isPathActive` in `nav-items.ts`.
 */
"use client";

import type { ComponentProps } from "react";
import { Blocks, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@elabs-ai/components-ui";
import { isPathActive, NAV_GROUPS, type NavItem } from "./nav-items";

export interface AppNavRailProps extends Omit<ComponentProps<typeof Sidebar>, "collapsible"> {
  /** Current route, for the R1 active-state indicator (router-agnostic — see `nav-items.ts`). */
  activePath: string;
  /** Product name shown in the brand block (hidden when the rail is collapsed). */
  productName?: string;
  /** Org / environment line under the product name (hidden when the rail is collapsed). */
  orgName?: string;
  /** Short environment label rendered in the footer meta line. */
  environment?: string;
}

function renderNavItem(item: NavItem, activePath: string) {
  const Icon = item.icon;
  const isActive = isPathActive(item.href, activePath);
  const subItems = item.items ?? [];

  const nodes = [
    <SidebarMenuItem key={item.id}>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <a href={item.href}>
          <Icon />
          <span>{item.label}</span>
        </a>
      </SidebarMenuButton>
      {subItems.length > 0 ? (
        <SidebarMenuSub>
          {subItems.map((sub) => (
            <SidebarMenuSubItem key={sub.id}>
              <SidebarMenuSubButton href={sub.href} isActive={isPathActive(sub.href, activePath)}>
                {sub.label}
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>,
  ];

  // Collapsed-rail mirror: `SidebarMenuSub` above is `group-data-[collapsible=icon]:hidden`
  // (sidebar.tsx), so a sub-item's own route would otherwise be unreachable once the rail
  // collapses to its 48px icon strip. Mirror each sub-item as its own top-level icon
  // button, visible ONLY in the collapsed state, so the route stays one click away.
  //
  // Exactly ONE of the two copies is ever displayed — the sub-menu list is hidden under
  // `collapsible=icon`, this mirror everywhere else — so the duplicate `href` never
  // reaches assistive tech twice. The `data-slot` is what lets a test target THIS copy:
  // both anchors share an `href`, and the hidden one wins `querySelector` by DOM order.
  for (const sub of subItems) {
    const SubIcon = sub.icon;
    nodes.push(
      <SidebarMenuItem
        key={`${sub.id}-collapsed`}
        data-slot="app-nav-rail-collapsed-item"
        className="hidden group-data-[collapsible=icon]:block"
      >
        <SidebarMenuButton
          asChild
          isActive={isPathActive(sub.href, activePath)}
          tooltip={sub.label}
        >
          <a href={sub.href}>
            <SubIcon />
            <span>{sub.label}</span>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>,
    );
  }

  return nodes;
}

export function AppNavRail({
  activePath,
  productName = "Console",
  orgName = "Acme Corp",
  environment = "Production",
  className,
  ...props
}: AppNavRailProps) {
  return (
    <Sidebar collapsible="icon" className={className} {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:justify-center">
          <Blocks aria-hidden="true" className="size-6 shrink-0 text-sidebar-primary" />
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-body font-semibold text-sidebar-foreground">
              {productName}
            </span>
            <span className="truncate text-meta text-sidebar-muted-foreground">{orgName}</span>
          </div>
        </div>
      </SidebarHeader>

      {/* `display: contents` keeps the landmark in the a11y tree without adding a
          layout box that would break `SidebarContent`'s own flex/scroll sizing. */}
      <nav aria-label="Primary" className="contents">
        <SidebarContent className="min-h-0 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.flatMap((item) => renderNavItem(item, activePath))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </nav>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isPathActive("/settings", activePath)}
              tooltip="Settings"
            >
              <a href="/settings">
                <Settings />
                <span>Settings</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <span className="truncate px-2 text-meta text-sidebar-muted-foreground group-data-[collapsible=icon]:hidden">
          {environment}
        </span>
      </SidebarFooter>
    </Sidebar>
  );
}
