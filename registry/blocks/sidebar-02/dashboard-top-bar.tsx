/**
 * The dashboard shell's top bar — the one row that says WHERE you are and gives
 * the three things an operator reaches for from any screen (search, what's new,
 * appearance), plus the control that opens the rail.
 *
 * Two deliberate shapes:
 *
 * 1. The rail toggle IS `SidebarTrigger`, unlike the flagship's hand-wired
 *    `IconButton`. This shell has exactly ONE `SidebarProvider`, so
 *    `useSidebar()` inside the bar resolves to the rail's own provider and the
 *    trigger toggles the thing it looks like it toggles — which also makes the
 *    frame's ⌘B/Ctrl+B shortcut and this button the same control. It is the
 *    only way to reopen the rail on a phone, where it becomes a closed sheet,
 *    so it never stands down at a breakpoint.
 *
 * 2. Breadcrumbs appear only at drill depth >= 2. One crumb is not a trail — it
 *    is a page title wearing a separator, and it costs a landmark and a row of
 *    chrome to say nothing. Below that depth the bar shows the page name as
 *    plain text.
 */
"use client";

import { Fragment, type ComponentProps } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  CommandTrigger,
  cn,
  NavNotifications,
  SidebarTrigger,
  ThemeSwitcher,
  type NavNotification,
} from "@elabs-ai/components-ui";
import { NAV_GROUPS } from "./nav-items";

/** One step of the trail: the route it points at and the word shown for it. */
export interface Crumb {
  href: string;
  label: string;
}

/** Demo notifications — replace with your own feed. */
export const DEMO_NOTIFICATIONS: NavNotification[] = [
  { id: "n1", fallback: "OR", text: "Order 4821 is waiting on stock.", time: "10m ago" },
  { id: "n2", fallback: "PY", text: "This week’s payout cleared.", time: "1h ago" },
  { id: "n3", fallback: "CS", text: "Three customers asked about delivery.", time: "2h ago" },
];

/** `href` -> label for every route the nav rail knows about. */
const NAV_LABELS: Record<string, string> = (() => {
  const labels: Record<string, string> = { "/settings": "Settings" };
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      labels[item.href] = item.label;
      for (const sub of item.items ?? []) labels[sub.href] = sub.label;
    }
  }
  return labels;
})();

function humanize(segment: string): string {
  const spaced = segment.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Split a route into its trail. A segment the nav rail names keeps that name;
 * anything else (an order id, a slug) is humanized, so a deep link still reads
 * as words instead of a path fragment.
 */
export function breadcrumbTrail(activePath: string): Crumb[] {
  const segments = activePath.split("/").filter(Boolean);
  if (segments.length === 0) return [{ href: "/", label: NAV_LABELS["/"] ?? "Overview" }];
  const crumbs: Crumb[] = [];
  let href = "";
  for (const segment of segments) {
    href += `/${segment}`;
    crumbs.push({ href, label: NAV_LABELS[href] ?? humanize(segment) });
  }
  return crumbs;
}

export interface DashboardTopBarProps extends ComponentProps<"header"> {
  /** Current route — drives the breadcrumb trail and the fallback page title. */
  activePath: string;
  /** Opens the app's command palette. Wire it to your own `CommandDialog`. */
  onSearch?: () => void;
  /** Entries in the notifications menu. @default DEMO_NOTIFICATIONS */
  notifications?: NavNotification[];
}

export function DashboardTopBar({
  activePath,
  onSearch,
  notifications = DEMO_NOTIFICATIONS,
  className,
  ...props
}: DashboardTopBarProps) {
  const crumbs = breadcrumbTrail(activePath);
  const showBreadcrumbs = crumbs.length >= 2;
  // `breadcrumbTrail` never returns an empty array, but `noUncheckedIndexedAccess`
  // is on, so the fallback is written rather than asserted away.
  const currentLabel = crumbs[crumbs.length - 1]?.label ?? "Overview";

  return (
    <header
      data-slot="dashboard-top-bar"
      // The bar carries no fill of its own — it sits on the same `bg-background`
      // canvas `SidebarInset` paints — so the rule under it is the SOLE
      // structural cue between chrome and content and takes the strong rung
      // (WCAG 1.4.11; see .claude/rules/styling-and-tokens.md).
      className={cn(
        "flex h-14 shrink-0 items-center gap-2 border-b border-border-strong px-3",
        className,
      )}
      {...props}
    >
      {/* 44x44 is the touch floor, and ONLY the touch floor: on a mouse-driven
          desktop the same square reads as oversized chrome. `pointer-coarse`
          asks about the input device rather than using a width breakpoint as a
          proxy for it, which is what gets a >=md tablet wrong. */}
      <SidebarTrigger className="pointer-coarse:size-11" />

      {showBreadcrumbs ? (
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList className="flex-nowrap">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                // The separator is a SIBLING of the item, not a child of it — it
                // is presentational chrome between two list items, and nesting it
                // inside one folds a "/" into that item's own text.
                <Fragment key={crumb.href}>
                  <BreadcrumbItem className="min-w-0">
                    {isLast ? (
                      <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={crumb.href} className="truncate">
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
      ) : (
        <span
          data-slot="dashboard-top-bar-title"
          className="min-w-0 flex-1 truncate text-body font-semibold text-foreground"
        >
          {currentLabel}
        </span>
      )}

      {/* The cluster never competes with the page name for room. Its controls
          are fixed-width, so without `shrink-0` here and `flex-1` on the title a
          320px phone gives the whole row to icons and crushes the title to a
          couple of pixels — a bar of chrome naming no page. Appearance is pure
          convenience, so it stands down below `sm`; navigation, search and
          what's-new stay at every width. */}
      <div className="flex shrink-0 items-center gap-1">
        <CommandTrigger onClick={onSearch} />
        <NavNotifications notifications={notifications} />
        <ThemeSwitcher className="hidden sm:inline-flex" />
      </div>
    </header>
  );
}
