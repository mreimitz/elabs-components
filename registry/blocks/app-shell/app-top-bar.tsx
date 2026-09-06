/**
 * The flagship shell's top bar — the one row that says WHERE you are and gives
 * you the four things an operator reaches for from any screen (search, help,
 * notifications, appearance), plus the two zone toggles the shell owns.
 *
 * Two deliberate shapes, both easy to get wrong when copying this block:
 *
 * 1. The zone toggles are plain `IconButton`s wired to the shell's own state,
 *    NOT `SidebarTrigger`. `SidebarTrigger` calls `useSidebar()`, which resolves
 *    to the NEAREST `SidebarProvider` — and this bar renders inside
 *    `SidebarInset`, i.e. inside the CONTEXT zone's provider. A `SidebarTrigger`
 *    here would toggle the right-hand rail while looking like a nav control.
 *    See `app-shell-page.tsx` for the three-provider arrangement.
 *
 * 2. Breadcrumbs appear only at drill depth >= 2. One crumb is not a trail — it
 *    is a page title wearing a separator, and it costs a landmark and a row of
 *    chrome to say nothing. Below that depth the bar shows the page name as
 *    plain text.
 */
"use client";

import { Fragment, type ComponentProps } from "react";
import { Bell, CircleHelp, PanelLeft, PanelRight } from "lucide-react";
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
  ThemeSwitcher,
} from "@elabs-ai/components-ui";
// Installed at `app/(app)/page.tsx`'s sibling depth via the consumer alias —
// see the note in `app-shell-page.tsx`.
import { NAV_GROUPS } from "@/components/app-shell/nav-items";

/** One step of the trail: the route it points at and the word shown for it. */
export interface Crumb {
  href: string;
  label: string;
}

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
 * anything else (a record id, a slug) is humanized, so a deep link still reads
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

export interface AppTopBarProps extends ComponentProps<"header"> {
  /** Current route — drives the breadcrumb trail and the fallback page title. */
  activePath: string;
  /** Nav-rail zone state (owned by `AppShellPage`). */
  navOpen: boolean;
  onNavOpenChange: (open: boolean) => void;
  /** Context-rail zone state (owned by `AppShellPage`). */
  contextOpen: boolean;
  onContextOpenChange: (open: boolean) => void;
  /** Opens the app's command palette. Wire it to your own `CommandDialog`. */
  onSearch?: () => void;
  /** Unread count folded into the notifications button's accessible name. */
  unreadCount?: number;
}

export function AppTopBar({
  activePath,
  navOpen,
  onNavOpenChange,
  contextOpen,
  onContextOpenChange,
  onSearch,
  unreadCount = 0,
  className,
  ...props
}: AppTopBarProps) {
  const crumbs = breadcrumbTrail(activePath);
  const showBreadcrumbs = crumbs.length >= 2;
  // `breadcrumbTrail` never returns an empty array, but `noUncheckedIndexedAccess`
  // is on, so the fallback is written rather than asserted away.
  const currentLabel = crumbs[crumbs.length - 1]?.label ?? "Overview";

  return (
    <header
      data-slot="app-top-bar"
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
      <IconButton
        label={navOpen ? "Collapse navigation" : "Expand navigation"}
        icon={<PanelLeft />}
        onClick={() => onNavOpenChange(!navOpen)}
        // 44x44 is the touch floor, and ONLY the touch floor: on a mouse-driven
        // desktop the same square reads as oversized chrome. `pointer-coarse`
        // asks about the input device rather than using a width breakpoint as a
        // proxy for it, which is what gets a >=md tablet wrong.
        className="pointer-coarse:size-11"
      />

      {showBreadcrumbs ? (
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList className="flex-nowrap">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                // The separator is a SIBLING of the item, not a child of it —
                // it is presentational chrome between two list items, and
                // nesting it inside one folds a "/" into that item.
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
          data-slot="app-top-bar-title"
          className="min-w-0 flex-1 truncate text-body font-semibold text-foreground"
        >
          {currentLabel}
        </span>
      )}

      {/* The cluster never competes with the page name for room. Its five
          controls are fixed-width, so on a 320px phone they used to consume the
          whole row and crush the title to 2px — a top bar of six icons naming no
          page. `shrink-0` plus a `flex-1` title fixes the priority; the two
          controls that are pure convenience (help, appearance) also stand down
          below `sm`, because on a phone the row is the scarcest space on screen.
          What stays at every width: navigation, search, notifications, details. */}
      <div className="flex shrink-0 items-center gap-1">
        <CommandTrigger onClick={onSearch} />
        <IconButton
          label="Help and documentation"
          icon={<CircleHelp />}
          className="hidden sm:inline-flex"
        />
        <span className="relative inline-flex">
          <IconButton
            // The count is part of the NAME on purpose: a bare "Notifications"
            // hides the one thing that decides whether it is worth opening.
            label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            icon={<Bell />}
          />
          {unreadCount > 0 ? (
            // The sighted channel for the same fact. It is `aria-hidden`
            // because the count already reaches assistive tech through the
            // button's own name — announcing it twice is noise, and a dot has
            // no reading of its own. Presence/absence of the shape is the cue,
            // so it does not rest on hue alone.
            //
            // The tone is `info`, not `primary`. A dot is a colour-only MARK,
            // so its fill must clear 3:1 against every surface it can land on —
            // and only the STATUS tones carry that guarantee
            // (`themes-contrast.test.ts`, "≥ 3:1 on every mark surface").
            // `--primary` carries no such promise and measures 1.36:1 against
            // `--background` in `light`; `--info` measures 4.66:1 there and
            // 6.40:1 in `dark`. The `ring-2 ring-background` is NOT the edge
            // that makes it visible (it is the page ground) — it only keeps the
            // dot off the bell glyph underneath it.
            <span
              aria-hidden="true"
              className="pointer-events-none absolute end-1.5 top-1.5 size-2 rounded-full bg-info ring-2 ring-background"
            />
          ) : null}
        </span>
        <ThemeSwitcher className="hidden sm:inline-flex" />
        <IconButton
          label={contextOpen ? "Hide the details rail" : "Show the details rail"}
          icon={<PanelRight />}
          onClick={() => onContextOpenChange(!contextOpen)}
        />
      </div>
    </header>
  );
}
