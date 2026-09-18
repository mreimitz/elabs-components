// registry: app-shell — copied 2026-09-18
"use client";
/**
 * The flagship shell's nav rail, trimmed for the hero scene: a non-collapsing `Sidebar` with
 * four items (the registry block's `NAV_GROUPS`, `NavUser` footer and collapsed-rail mirror are
 * dropped — the scene has no router and no session). Items are buttons: the demo navigates
 * nowhere.
 */
import type { CSSProperties } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@elabs-ai/components-ui";

export interface HeroNavItem {
  id: string;
  label: string;
}

export interface HeroNavRailProps {
  productName: string;
  orgName: string;
  items: HeroNavItem[];
  activeId: string;
}

const RAIL_WIDTH = { "--sidebar-width": "11rem" } as CSSProperties;

export function HeroNavRail({ productName, orgName, items, activeId }: HeroNavRailProps) {
  return (
    <SidebarProvider className="min-h-0 w-auto shrink-0" style={RAIL_WIDTH}>
      <Sidebar collapsible="none" className="border-e border-sidebar-border">
        <SidebarHeader>
          <div className="flex flex-col px-2 py-1">
            <span className="truncate text-body font-semibold">{productName}</span>
            <span className="truncate text-meta text-sidebar-muted-foreground">{orgName}</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton isActive={item.id === activeId}>
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
