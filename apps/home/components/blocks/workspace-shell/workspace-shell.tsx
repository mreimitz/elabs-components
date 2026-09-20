// registry: workspace-shell — copied 2026-09-19
/**
 * Workspace shell — the frame every full-screen template in this registry sits in:
 *
 *     [ nav rail ][ top bar + your screen ][ summoned dock ]
 *
 * It is the flagship app shell (`app-shell`) with its content taken out and its data turned
 * into props: you pass the navigation, the signed-in user, the trail and what the dock holds,
 * and render your screen as `children`. Same rules as the flagship: two zones, a flush
 * content column, and a right-hand surface that is summoned rather than always there.
 *
 * `frame="container"` renders the whole app INSIDE a box (a docs page, a preview pane): the
 * rail and the dock pin to the box instead of the window, and the frame takes the box's
 * height. Give that box a height. The default, `"viewport"`, is a real app: `h-svh`.
 */
"use client";

import { Fragment, useState, type ReactNode } from "react";
import { PanelLeft, PanelRight, type LucideIcon } from "lucide-react";
import { AppIcon } from "@elabs-ai/components-icons";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  cn,
  CommandTrigger,
  IconButton,
  NavNotifications,
  NavUser,
  SideDock,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SkipLink,
  ThemeSwitcher,
  type NavNotification,
  type NavUserUser,
} from "@elabs-ai/components-ui";

export interface WorkspaceNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** A count beside the label — open items, unread, alerts. Text, never a bare dot. */
  badge?: string;
}

export interface WorkspaceNavGroup {
  label: string;
  items: WorkspaceNavItem[];
}

export interface WorkspaceCrumb {
  href: string;
  label: string;
}

export interface WorkspaceDock {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Words for the toggle: "Show the assistant" / "Hide the assistant". */
  showLabel?: string;
  hideLabel?: string;
  defaultOpen?: boolean;
  /** Controlled open state — for a dock a row click summons. Pair with `onOpenChange`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultWidth?: number;
}

export interface WorkspaceShellProps {
  productName: string;
  orgName: string;
  user: NavUserUser;
  nav: WorkspaceNavGroup[];
  /** The `id` of the nav item this screen belongs to. */
  activeId: string;
  /**
   * Handle navigation yourself — a client-side router, or a screen that swaps views in place.
   * When set, a nav click calls this instead of following the item's `href`.
   */
  onNavigate?: (item: WorkspaceNavItem) => void;
  /** The trail in the top bar; the last entry is the current page. */
  trail: WorkspaceCrumb[];
  notifications?: NavNotification[];
  /** Opens your command palette. */
  onSearch?: () => void;
  /** Extra top-bar controls, placed before search. */
  actions?: ReactNode;
  /** The summoned right-hand surface. Omit it and no toggle renders. */
  dock?: WorkspaceDock;
  /** `"viewport"` is a real app (`h-svh`); `"container"` fills a box you give a height. */
  frame?: "viewport" | "container";
  /** Padding of the scroll port. `"flush"` for screens that own their edges (a map, a canvas). */
  inset?: "padded" | "flush";
  defaultNavOpen?: boolean;
  children: ReactNode;
}

export function WorkspaceShell({
  productName,
  orgName,
  user,
  nav,
  activeId,
  onNavigate,
  trail,
  notifications = [],
  onSearch,
  actions,
  dock,
  frame = "viewport",
  inset = "padded",
  defaultNavOpen = true,
  children,
}: WorkspaceShellProps) {
  const [navOpen, setNavOpen] = useState(defaultNavOpen);
  const [ownDockOpen, setOwnDockOpen] = useState(dock?.defaultOpen ?? false);
  const dockOpen = dock?.open ?? ownDockOpen;
  const setDockOpen = (open: boolean) => {
    setOwnDockOpen(open);
    dock?.onOpenChange?.(open);
  };
  const position = frame === "container" ? "inset" : "viewport";

  return (
    <SidebarProvider
      open={navOpen}
      onOpenChange={setNavOpen}
      className={frame === "container" ? "relative h-full min-h-0 overflow-hidden" : "h-svh"}
      data-nav={navOpen ? "expanded" : "collapsed"}
      data-dock={dock && dockOpen ? "open" : "closed"}
      data-slot="workspace-shell"
    >
      <SkipLink />

      <Sidebar collapsible="icon" containerPosition={position} data-density="comfortable">
        <SidebarHeader className="gap-0 p-0">
          {/* The rail's top is a header band like the top bar beside it: the ONE shared height
              (`h-header`) and a bottom rule, so the two rules sit on one line in every theme
              and at every density. `SidebarHeader`'s own padding would make it content-sized. */}
          <div
            className="flex h-header shrink-0 items-center gap-2 border-b border-sidebar-border px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            data-slot="sidebar-brand"
          >
            <AppIcon className="shrink-0" height={22} morph="auto" title={productName} />
            <span className="min-w-0 truncate text-meta text-sidebar-muted-foreground group-data-[collapsible=icon]:hidden">
              {orgName}
            </span>
          </div>
        </SidebarHeader>
        <nav aria-label="Primary" className="contents">
          <SidebarContent className="min-h-0 overflow-y-auto">
            {nav.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            asChild
                            isActive={item.id === activeId}
                            tooltip={item.label}
                          >
                            <a
                              href={item.href}
                              onClick={
                                onNavigate
                                  ? (event) => {
                                      event.preventDefault();
                                      onNavigate(item);
                                    }
                                  : undefined
                              }
                            >
                              <Icon />
                              <span>{item.label}</span>
                            </a>
                          </SidebarMenuButton>
                          {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
        </nav>
        <SidebarFooter>
          <NavUser settingsHref="#settings" user={user} />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0" id="main-content" tabIndex={-1}>
        <header
          className="flex h-header shrink-0 items-center gap-2 border-b border-border-strong px-3"
          data-slot="workspace-top-bar"
        >
          <IconButton
            aria-expanded={navOpen}
            className="pointer-coarse:size-11"
            icon={<PanelLeft />}
            label={navOpen ? "Collapse navigation" : "Expand navigation"}
            onClick={() => setNavOpen(!navOpen)}
          />
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-nowrap">
              {trail.map((crumb, index) => {
                const isLast = index === trail.length - 1;
                return (
                  <Fragment key={crumb.href}>
                    <BreadcrumbItem className="min-w-0">
                      {isLast ? (
                        <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink className="truncate" href={crumb.href}>
                          {crumb.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {isLast ? null : <BreadcrumbSeparator />}
                  </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            <CommandTrigger onClick={onSearch} />
            {notifications.length > 0 ? (
              <NavNotifications align="end" notifications={notifications} side="bottom" />
            ) : null}
            <ThemeSwitcher className="hidden sm:inline-flex" variant="ghost" />
            {dock ? (
              <IconButton
                aria-expanded={dockOpen}
                icon={<PanelRight />}
                label={
                  dockOpen
                    ? (dock.hideLabel ?? "Hide the side panel")
                    : (dock.showLabel ?? "Show the side panel")
                }
                onClick={() => setDockOpen(!dockOpen)}
              />
            ) : null}
          </div>
        </header>
        <div
          className={cn(
            // A query container: a screen inside lays itself out by the room it HAS (dock open, rail
            // expanded, the whole app in a preview box), not by the window.
            "@container min-h-0 flex-1 overflow-y-auto focus-ring-inset",
            inset === "padded" && "px-4 py-6 sm:px-6 lg:px-8",
          )}
          data-slot="workspace-content"
          tabIndex={0}
        >
          {children}
        </div>
      </SidebarInset>

      {dock ? (
        <SideDock
          containerPosition={position}
          defaultWidth={dock.defaultWidth}
          description={dock.description}
          onOpenChange={setDockOpen}
          open={dockOpen}
          title={dock.title}
        >
          {dock.children}
        </SideDock>
      ) : null}
    </SidebarProvider>
  );
}
