/**
 * The flagship shell's top bar — the one row that says WHERE you are and gives
 * you the things an operator reaches for from any screen (search, notifications,
 * appearance, and help when the consumer wires it), plus the two zone toggles
 * the shell owns.
 *
 * Two deliberate shapes, both easy to get wrong when copying this block:
 *
 * 1. The nav toggle is a plain `IconButton` wired to the shell's own state, NOT
 *    a `SidebarTrigger`. The shell drives the rail CONTROLLED (one `open` state
 *    the bar and the rail both read), and the dock toggle next to it drives a
 *    surface that is not a `Sidebar` at all — so both controls are the same kind
 *    of thing, and neither reaches into a provider. See `app-shell-page.tsx`.
 *
 * 2. Breadcrumbs appear only at drill depth >= 2. One crumb is not a trail — it
 *    is a page title wearing a separator, and it costs a landmark and a row of
 *    chrome to say nothing. Below that depth the bar shows the page name as
 *    plain text.
 */
"use client";

import { Fragment, type ComponentProps } from "react";
import { CircleHelp, PanelLeft, PanelRight } from "lucide-react";
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
  type NavNotification,
  ThemeSwitcher,
} from "@elabs-ai/components-ui";
// Installed at `app/(app)/page.tsx`'s sibling depth via the consumer alias —
// see the note in `app-shell-page.tsx`.
import { NAV_GROUPS } from "@/components/app-shell/nav-items";

/** Demo notifications — replace with your own feed. */
export const DEMO_NOTIFICATIONS: NavNotification[] = [
  { id: "1", fallback: "AR", text: "Ava Reyes assigned you “Q3 forecast”", time: "12m ago" },
  { id: "2", fallback: "SM", text: "Sam Mori commented on “Pipeline health”", time: "1h ago" },
  { id: "3", fallback: "JT", text: "Jordan Tam shared a report with you", time: "Yesterday" },
];

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
  /** Assistant-dock state (owned by `AppShellPage`). */
  dockOpen: boolean;
  /**
   * Render the dock disclosure at all. Set it `false` where the shell mounts no
   * dock — a toggle for a surface that is not there takes focus, shows a
   * pointer cursor and does nothing, which is the same defect the dead Help
   * button was. @default true
   */
  showDockToggle?: boolean;
  onDockOpenChange: (open: boolean) => void;
  /** Opens the app's command palette. Wire it to your own `CommandDialog`. */
  onSearch?: () => void;
  /**
   * Opens your help surface. The button renders ONLY when this is supplied —
   * a control that takes focus, shows a pointer cursor and does nothing is
   * worse than no control, and this block is a copy-own exemplar.
   */
  onHelp?: () => void;
  /** Entries in the notifications menu. @default DEMO_NOTIFICATIONS */
  notifications?: NavNotification[];
}

export function AppTopBar({
  activePath,
  navOpen,
  onNavOpenChange,
  dockOpen,
  showDockToggle = true,
  onDockOpenChange,
  onSearch,
  onHelp,
  notifications = DEMO_NOTIFICATIONS,
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
        // A disclosure control, so the state is exposed as STATE. The
        // state-carrying name stays — it is good copy, and it complements the
        // attribute rather than competing with it — but a name that mutates
        // under the user is not reliably re-announced, and `aria-expanded` is
        // what the platform provides for exactly this (WCAG 4.1.2).
        //
        // No `aria-controls`, deliberately: below the shell's own breakpoint the
        // nav zone is an unmounted `Sheet`, and pointing `aria-controls` at an
        // id that is not in the document is an axe `aria-valid-attr-value`
        // failure. Do not "fix" this later into a dangling id.
        aria-expanded={navOpen}
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

      {/* The cluster never competes with the page name for room. Its controls
          are fixed-width, so on a 320px phone they used to consume the whole row
          and crush the title to 2px — a top bar of six icons naming no page.
          `shrink-0` plus a `flex-1` title fixes the priority; the two controls
          that are pure convenience (help, appearance) also stand down below
          `sm`, because on a phone the row is the scarcest space on screen.
          What stays at every width: navigation, search, notifications, assistant. */}
      <div className="flex shrink-0 items-center gap-1">
        <CommandTrigger onClick={onSearch} />
        {/* Rendered only when the consumer supplies a handler — see `onHelp`. */}
        {onHelp ? (
          <IconButton
            label="Help and documentation"
            icon={<CircleHelp />}
            onClick={onHelp}
            className="hidden sm:inline-flex"
          />
        ) : null}
        {/* The same working component all three sibling shells render, with the
            same non-default placement: `side="bottom" align="end"`, because from
            a trigger at the END of a top bar the component's rail default
            (`side="right"`) has nowhere to go — Radix collision-handling flips
            the menu back across the trigger and it covers the controls beside
            it.

            This replaces a hand-rolled `Bell` `IconButton` + unread dot that had
            no `onClick` at all. What went with it: an unread COUNT folded into
            the trigger's accessible name. `NavNotifications` has no unread seam,
            and adding one is a change to a shipped `@elabs-ai/components-ui`
            component that all four shells would share — not a per-block edit. */}
        <NavNotifications notifications={notifications} side="bottom" align="end" />
        <ThemeSwitcher className="hidden sm:inline-flex" />
        {/* Absent, not disabled, where the shell mounts no dock — see
            `showDockToggle`. */}
        {showDockToggle ? (
          <IconButton
            label={dockOpen ? "Hide the assistant" : "Show the assistant"}
            icon={<PanelRight />}
            // Same disclosure contract as the nav toggle above, and the same
            // reason for omitting `aria-controls`.
            aria-expanded={dockOpen}
            onClick={() => onDockOpenChange(!dockOpen)}
          />
        ) : null}
      </div>
    </header>
  );
}
