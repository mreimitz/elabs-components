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

import { Fragment, type ComponentProps } from "react";
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
  SidebarSeparator,
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
  // `href` never reaches assistive tech twice. The two copies are told apart by
  // the LIBRARY's own slots — this one is a `sidebar-menu-button`, the sub-menu
  // copy a `sidebar-menu-sub-button` — so a test needs no marker of ours. NEVER
  // pass a `data-slot` of your own to `SidebarMenuItem`: it spreads `...props`
  // last, so it would delete the library's `sidebar-menu-item` here.
  for (const sub of subItems) {
    const SubIcon = sub.icon;
    nodes.push(
      <SidebarMenuItem
        key={`${sub.id}-collapsed`}
        className="hidden group-data-[collapsible=icon]:block"
      >
        {/* The tooltip is the only TEXT a collapsed rail shows, so it names the
            parent too — without it the mirror reads as a seventh top-level
            destination rather than as a child of the entry above it. The
            anchor's accessible name still comes from the <span> and stays the
            sub-route's own label. */}
        <SidebarMenuButton
          asChild
          isActive={isPathActive(sub.href, activePath)}
          tooltip={`${item.label} · ${sub.label}`}
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
      // NO `data-density` pin here, and that is deliberate (measured
      // 2026-09-06). `Sidebar` spreads `...props` onto its `sidebar-container`
      // only — its width SPACER (`sidebar-gap`) is a sibling that keeps reading
      // the document's density. Pinning the container therefore desynchronises
      // the pair: under a document `data-density="compact"` the spacer stays at
      // the compact width while the container renders at the comfortable one,
      // opening a seam twice the designed inset offset. Unpinned, compact
      // simply renders a narrower rail — smaller, not broken. Locked by the
      // `CompactDensity` story.
    >
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>

      {/* `display: contents` keeps the landmark in the accessibility tree without
          adding a layout box that would break `SidebarContent`'s flex/scroll sizing. */}
      <nav aria-label="Primary" className="contents">
        <SidebarContent className="min-h-0 overflow-y-auto">
          {NAV_GROUPS.map((group, index) => (
            <Fragment key={group.label}>
              {/* Collapsed, `SidebarGroupLabel` is clipped away and the rail
                  would otherwise be one undifferentiated strip of glyphs. The
                  rule is `border-strong` when a line is the SOLE structural cue
                  — but this one is not: it only appears in the state where the
                  labels are gone, and the group gap is still there, so the
                  subtle sidebar rung is right. Expanded, the labels do the job
                  and the line is redundant, so it is hidden. */}
              {index > 0 ? (
                <SidebarSeparator className="hidden group-data-[collapsible=icon]:block" />
              ) : null}
              <SidebarGroup>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.flatMap((item) => renderNavItem(item, activePath))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </Fragment>
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
