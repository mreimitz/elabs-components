/**
 * The dashboard shell's nav rail — one collapsible-icon `Sidebar` carrying the
 * tenant switcher, the router-agnostic `NAV_GROUPS` from `nav-items.ts`, and a
 * settings row pinned to the foot.
 *
 * The rail is app CHROME, so every string on it reaches for the sidebar ink
 * pair (`text-sidebar-foreground` / `text-sidebar-muted-foreground`), never the
 * canvas pair. In the `light` reference theme the chrome ground is dark while
 * the canvas is near-white, so canvas ink here measures ~2.3:1 — a real 1.4.3
 * failure that reads fine on `dark` and is invisible until someone looks at the
 * other theme.
 */
"use client";

import type { ComponentProps } from "react";
import { Settings, Ship, Store, Warehouse } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  TeamSwitcher,
  type TeamSwitcherTeam,
} from "@elabs-ai/components-ui";
import { isPathActive, NAV_GROUPS, type NavItem } from "./nav-items";

/** Demo tenants — replace with your own. */
export const DEMO_TEAMS: TeamSwitcherTeam[] = [
  { name: "Northwind Supply", logo: Store, plan: "Growth" },
  { name: "Meridian Goods", logo: Warehouse, plan: "Starter" },
  { name: "Harbour Trading", logo: Ship, plan: "Growth" },
];

export interface DashboardSidebarProps extends Omit<ComponentProps<typeof Sidebar>, "collapsible"> {
  /** Current route, for the active-state indicator (router-agnostic — see `nav-items.ts`). */
  activePath: string;
  /** Tenants offered by the switcher in the rail's header. @default DEMO_TEAMS */
  teams?: TeamSwitcherTeam[];
  /** Short environment label rendered in the footer meta line. */
  environment?: string;
}

function renderNavItem(item: NavItem, activePath: string) {
  const Icon = item.icon;
  const subItems = item.items ?? [];

  const nodes = [
    <SidebarMenuItem key={item.id}>
      {/* `isActive` is the whole active-state treatment: `sidebarMenuButtonVariants`
          already draws the accent fill, the semibold label, the primary-tinted
          glyph AND the `before:` leading rail. Don't restate any of it here. */}
      <SidebarMenuButton
        asChild
        isActive={isPathActive(item.href, activePath)}
        tooltip={item.label}
      >
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

  // Collapsed-rail mirror: `SidebarMenuSub` above carries
  // `group-data-[collapsible=icon]:hidden` (sidebar.tsx), so a sub-route would
  // otherwise be unreachable the moment the rail collapses to its icon strip.
  // Mirror each sub-item as its own top-level icon button, shown ONLY while
  // collapsed, so the route stays one click away.
  //
  // Exactly ONE of the two copies is ever displayed — the sub-menu under every
  // state but `collapsible=icon`, this mirror only under it — so the duplicated
  // `href` never reaches assistive tech twice. The `data-slot` is what lets a
  // test target THIS copy: both anchors share an `href`, and the sub-menu one
  // wins `querySelector` by DOM order.
  for (const sub of subItems) {
    const SubIcon = sub.icon;
    nodes.push(
      <SidebarMenuItem
        key={`${sub.id}-collapsed`}
        data-slot="dashboard-nav-collapsed-item"
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

export function DashboardSidebar({
  activePath,
  teams = DEMO_TEAMS,
  environment = "Production",
  className,
  ...props
}: DashboardSidebarProps) {
  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className={className}
      {...props}
      // Pinned, not decorative: the rail's collapsed icon buttons size off
      // `--spacing`, and under `compact` density that shrinks the icon strip
      // below the fixed rail width the collapsed layout assumes. Written AFTER
      // `{...props}` on purpose — a caller who spreads `data-density` would
      // otherwise silently defeat the pin (last JSX attribute wins).
      data-density="comfortable"
    >
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>

      {/* `display: contents` keeps the landmark in the accessibility tree without
          adding a layout box that would break `SidebarContent`'s flex/scroll sizing. */}
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
