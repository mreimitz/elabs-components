/**
 * The settings shell's top bar — where you are, and the four things reachable
 * from every settings screen.
 *
 * Three shapes worth keeping when you copy this:
 *
 * 1. The panel toggle IS `SidebarTrigger`. The shell has exactly ONE
 *    `SidebarProvider`, so `useSidebar()` here resolves to the section panel's
 *    own provider and this button, the ⌘B/Ctrl+B shortcut and the rail's
 *    re-click are three ways to drive one piece of state. It is also the only
 *    way to reopen the panel on a phone, where it becomes a closed sheet — so
 *    it never stands down at a breakpoint.
 *
 * 2. Breadcrumbs appear only at depth >= 2. One crumb is not a trail, it is a
 *    page title wearing a separator. `Settings / Access / Sign-in` is depth 3;
 *    the area landing route is depth 2; anything shallower falls back to a
 *    plain title.
 *
 * 3. The change-history control is a disclosure, not a link, so it carries
 *    `aria-expanded` for the dock it summons. `aria-controls` is deliberately
 *    absent: below the dock's `overlayBreakpoint` the panel is an unmounted
 *    `Sheet`, and pointing `aria-controls` at an id that is not in the document
 *    is an axe `aria-valid-attr-value` failure.
 */
"use client";

import { Fragment, type ComponentProps } from "react";
import { History } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  CommandTrigger,
  cn,
  IconButton,
  NavNotifications,
  SidebarTrigger,
  ThemeSwitcher,
  type NavNotification,
} from "@elabs-ai/components-ui";
import { SETTINGS_AREAS } from "./nav-items";

/** One step of the trail: the route it points at and the word shown for it. */
export interface Crumb {
  href: string;
  label: string;
}

/** Demo notifications — replace with your own feed. */
export const DEMO_NOTIFICATIONS: NavNotification[] = [
  { id: "n1", fallback: "AO", text: "Ada Okonkwo changed the session length.", time: "2h ago" },
  { id: "n2", fallback: "ST", text: "The nightly extract finished.", time: "6h ago" },
];

/*
 * `NAV_LABELS`, `humanize` and `breadcrumbTrail` below are a DELIBERATE copy of
 * the sibling `app-shell` / `sidebar-04` blocks' top bars, for the same reason
 * `isPathActive` is copied into `nav-items.ts`: registry blocks are copy-own,
 * and `npx shadcn add sidebar-05` must install a block that works on its own.
 * An import from `@/components/app-shell/…` would resolve here in the source
 * tree and then break for anyone who did not also install the flagship. Keep
 * the copies in step by hand.
 */

/** `href` -> label for every route the two rails know about. */
const NAV_LABELS: Record<string, string> = (() => {
  const labels: Record<string, string> = { "/settings": "Settings" };
  for (const area of SETTINGS_AREAS) {
    labels[`/settings/${area.id}`] = area.label;
    for (const section of area.sections) {
      labels[`/settings/${area.id}/${section.id}`] = section.label;
    }
  }
  return labels;
})();

function humanize(segment: string): string {
  const spaced = segment.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Split a route into its trail. A segment the rails name keeps that name;
 * anything else is humanized, so a deep link still reads as words instead of a
 * path fragment.
 */
export function breadcrumbTrail(activePath: string): Crumb[] {
  const segments = activePath.split("/").filter(Boolean);
  if (segments.length === 0) return [{ href: "/settings", label: "Settings" }];
  const crumbs: Crumb[] = [];
  let href = "";
  for (const segment of segments) {
    href += `/${segment}`;
    crumbs.push({ href, label: NAV_LABELS[href] ?? humanize(segment) });
  }
  return crumbs;
}

export interface SettingsTopBarProps extends ComponentProps<"header"> {
  /** Current route — drives the trail and the fallback page title. */
  activePath: string;
  /** Opens the app's command palette. Wire it to your own `CommandDialog`. */
  onSearch?: () => void;
  /** Entries in the notifications menu. @default DEMO_NOTIFICATIONS */
  notifications?: NavNotification[];
  /** Whether the change-history dock is open. */
  historyOpen: boolean;
  /** Toggles the change-history dock. */
  onHistoryOpenChange: (open: boolean) => void;
}

export function SettingsTopBar({
  activePath,
  onSearch,
  notifications = DEMO_NOTIFICATIONS,
  historyOpen,
  onHistoryOpenChange,
  className,
  ...props
}: SettingsTopBarProps) {
  const crumbs = breadcrumbTrail(activePath);
  const showBreadcrumbs = crumbs.length >= 2;
  // `breadcrumbTrail` never returns an empty array, but `noUncheckedIndexedAccess`
  // is on, so the fallback is written rather than asserted away.
  const currentLabel = crumbs[crumbs.length - 1]?.label ?? "Settings";

  return (
    <header
      data-slot="settings-top-bar"
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
                // is presentational chrome between two list items, and nesting
                // it inside one folds a "/" into that item's own text.
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
          data-slot="settings-top-bar-title"
          className="min-w-0 flex-1 truncate text-body font-semibold text-foreground"
        >
          {currentLabel}
        </span>
      )}

      {/* The cluster never competes with the trail for room. Its controls are
          fixed-width, so without `shrink-0` here and `flex-1` on the trail a
          320px phone gives the whole row to icons and crushes the trail to a
          couple of pixels. Appearance is pure convenience, so it stands down
          below `sm`; navigation, search and history stay at every width. */}
      <div className="flex shrink-0 items-center gap-1">
        <CommandTrigger onClick={onSearch} />
        <IconButton
          label="Change history"
          icon={<History />}
          variant={historyOpen ? "secondary" : "ghost"}
          aria-expanded={historyOpen}
          onClick={() => onHistoryOpenChange(!historyOpen)}
          className="pointer-coarse:size-11"
        />
        {/* `side="bottom" align="end"`, not the component's rail defaults. From
            a trigger at the END of a top bar, `side="right"` has nowhere to go:
            Radix collision-handling flips the menu back across the trigger and
            it covers the control beside it. */}
        <NavNotifications notifications={notifications} side="bottom" align="end" />
        <ThemeSwitcher className="hidden sm:inline-flex" />
      </div>
    </header>
  );
}
