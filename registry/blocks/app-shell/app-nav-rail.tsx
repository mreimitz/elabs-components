/**
 * The flagship shell's nav rail — a collapsible-icon `Sidebar` wired to the
 * router-agnostic `NAV_GROUPS`/`isPathActive` in `nav-items.ts`.
 */
"use client";

import type { ComponentProps } from "react";
import { Settings } from "lucide-react";
import { AppIcon } from "@elabs-ai/components-icons";
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
  // reaches assistive tech twice. The two copies are told apart by the LIBRARY's own
  // slots — this one is a `sidebar-menu-button`, the sub-menu copy a
  // `sidebar-menu-sub-button` — so a test needs no marker of ours. NEVER pass a
  // `data-slot` of your own to `SidebarMenuItem`: it spreads `...props` last, so it
  // would delete the library's `sidebar-menu-item` here.
  for (const sub of subItems) {
    const SubIcon = sub.icon;
    nodes.push(
      <SidebarMenuItem
        key={`${sub.id}-collapsed`}
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
    // `data-density="comfortable"` pins the rail to the identity spacing scale
    // regardless of the app-wide density. The collapsed icon buttons are sized
    // `size-8`/`p-2`, which scale with `--spacing` — under `compact` they shrink
    // below the fixed 3rem icon rail and sit visibly off-centre.
    <Sidebar collapsible="icon" data-density="comfortable" className={className} {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:justify-center">
          {/* `AppIcon` is the library's own app-chrome brand mark — never a stock
              glyph, and never a hand-rolled `BrandLogo`. It is theme-correct on
              its own (it reads the per-theme brand-mark tokens) and `morph="auto"`
              renders the full lockup — glyph + the `title` as its wordmark — that
              crossfades to the glyph alone when this rail collapses to its icon
              width. Replace `title` with your product's name; swap the mark itself
              by re-pointing the brand tokens, not by editing this block. */}
          <AppIcon morph="auto" title={productName} height={22} className="shrink-0" />
          {/* The lockup above already carries the product name, so this line is
              the org / environment only. Sidebar ink, not page ink: the rail is a
              `--sidebar` ground, and in the light reference theme page ink on it
              is a real contrast failure. */}
          <span className="min-w-0 truncate text-meta text-sidebar-muted-foreground group-data-[collapsible=icon]:hidden">
            {orgName}
          </span>
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
