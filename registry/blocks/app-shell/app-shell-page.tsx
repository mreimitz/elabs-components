/**
 * The flagship app shell — the shape this library recommends by default, and a
 * direct port of the shell the elabs AI Workbench ships:
 *
 *     [ nav rail ][ top bar + content ][ assistant dock ]
 *
 * THREE things about it are deliberate, and are the things a copier most often
 * gets wrong:
 *
 * 1. **Two zones, not four.** A navigation rail and a content column. A second
 *    left-hand column (a mail-style list of records) is a DIFFERENT archetype —
 *    reach for `Layout/App Shell/Mail`, which is built for it. Stacking a list
 *    column beside the nav rail on a screen that does not need one costs ~280px
 *    of content and reads as two menus doing one job.
 *
 * 2. **The content surface is FLUSH — no `variant="inset"`.** `SidebarInset`
 *    renders the app's single `<main>` edge to edge on the `--background`
 *    canvas, with the rail flush against the window. The floating rounded card
 *    (`variant="inset"` on the provider) is an alternative look, not the house
 *    style; the workbench does not use it and neither does this shell.
 *
 * 3. **The right-hand surface is a SUMMONED dock, not permanent furniture.**
 *    `SideDock` transitions its width between 0 and the chosen width, exactly
 *    the mechanic the left rail uses, and is resizable. A right-hand panel that
 *    is always present as an icon strip is the other pattern the library ships
 *    (`ContextRail`) — see `Layout/App Shell/Dashboard`, which uses it because a
 *    briefing screen's details are always relevant. Pick by whether the panel is
 *    something you SUMMON or something that is always there.
 *
 * One `SidebarProvider` wraps the whole frame: the nav rail is the only
 * `Sidebar` here, so there is nothing for a second provider to own. The dock is
 * a flex SIBLING of `SidebarInset`, not a child of it — an `aside` inside
 * `<main>` puts a complementary landmark inside the main landmark.
 */
"use client";

import { useState } from "react";
import { BookOpen, Info, TriangleAlert } from "lucide-react";
import {
  PageShell,
  SideDock,
  SidebarInset,
  SidebarProvider,
  SkipLink,
} from "@elabs-ai/components-ui";
// This file installs at `app/(app)/page.tsx` (see the `fileOverrides` entry in
// registry.items.json) — outside `components/app-shell/`, so a relative import to a
// sibling in this source folder wouldn't resolve in the install tree. Use the
// consumer-side alias instead (see .claude/rules/registry.md "One copy of shared code").
import { AppNavRail } from "@/components/app-shell/app-nav-rail";
import { AppTopBar } from "@/components/app-shell/app-top-bar";
import {
  ConsoleOverview,
  type ActivityEntry,
  type ConsoleMetric,
  type RunRow,
} from "@/components/app-shell/console-overview";

/**
 * The dock's body. Ordinary CANVAS ink — unlike `ContextRail`, `SideDock` is
 * grounded on `--card`, a content surface, so page ink is the correct pair here
 * and sidebar ink would be the mistake.
 */
function AssistantDockBody({ alertCount }: { alertCount: number }) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="dock-details">
        <h3
          id="dock-details"
          className="mb-2 flex items-center gap-2 text-body font-semibold text-foreground"
        >
          <Info aria-hidden="true" className="size-4 text-muted-foreground" />
          Details
        </h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
          <dt className="text-muted-foreground">Owner</dt>
          <dd className="text-foreground">Ada Okonkwo</dd>
          <dt className="text-muted-foreground">Schedule</dt>
          <dd className="text-foreground">Every 15 minutes</dd>
          <dt className="text-muted-foreground">Retention</dt>
          <dd className="text-foreground">90 days</dd>
          <dt className="text-muted-foreground">Last change</dt>
          <dd className="text-foreground">2 days ago</dd>
        </dl>
      </section>

      <section aria-labelledby="dock-alerts">
        <h3
          id="dock-alerts"
          className="mb-2 flex items-center gap-2 text-body font-semibold text-foreground"
        >
          <TriangleAlert aria-hidden="true" className="size-4 text-muted-foreground" />
          Alerts
          {/* The count is TEXT, not a colour-only dot — see the 1.4.1 rule. */}
          <span className="text-meta font-normal text-muted-foreground">({alertCount})</span>
        </h3>
        <ul className="space-y-3 text-body">
          <li>
            <p className="text-foreground">Schema drift on Orders ingest</p>
            <p className="text-meta text-muted-foreground">Raised 06:12 · unacknowledged</p>
          </li>
          <li>
            <p className="text-foreground">Row delta above the 5% guardrail</p>
            <p className="text-meta text-muted-foreground">Raised 05:48 · waiting on approval</p>
          </li>
        </ul>
      </section>

      <section aria-labelledby="dock-docs">
        <h3
          id="dock-docs"
          className="mb-2 flex items-center gap-2 text-body font-semibold text-foreground"
        >
          <BookOpen aria-hidden="true" className="size-4 text-muted-foreground" />
          Docs
        </h3>
        <p className="text-body text-muted-foreground">
          Runbooks and schema notes for the selected pipeline appear here.
        </p>
      </section>
    </div>
  );
}

export interface AppShellPageProps {
  /** Current route, forwarded to the nav rail for the active-state indicator. */
  activePath?: string;
  /** Render the chrome with an EMPTY content slot — the frame, nothing in it. */
  emptyContent?: boolean;
  /** Nav rail starts expanded. @default true */
  defaultNavOpen?: boolean;
  /** Assistant dock starts open. @default false — a dock is summoned. */
  defaultDockOpen?: boolean;
  /** Mount the assistant dock at all. @default true */
  showDock?: boolean;
  /** No renderable data yet — every region shows its own layout-shaped skeleton. */
  loading?: boolean;
  /* ---- Data pass-throughs. A copy-own block takes data in and renders chrome
     out; every one of these defaults to the demo fixture beside it, so the
     block renders believably before you have wired anything up. ---- */
  /** Tiles of the console's metric row. @default DEMO_METRICS */
  metrics?: ConsoleMetric[];
  /** Rows of the console's runs table. @default DEMO_RUNS */
  runs?: RunRow[];
  /** Entries of the console's activity timeline. @default DEMO_ACTIVITY */
  activity?: ActivityEntry[];
  /**
   * Viewport width below which the dock renders as an overlay `Sheet` instead
   * of a column. Forwarded verbatim to `SideDock`; its own default is 1100,
   * deliberately above the library's 768px mobile breakpoint (a 400px dock at
   * 768px leaves ~360px of content).
   */
  dockOverlayBreakpoint?: number;
}

export default function AppShellPage({
  activePath = "/",
  emptyContent = false,
  defaultNavOpen = true,
  defaultDockOpen = false,
  showDock = true,
  loading = false,
  metrics,
  runs,
  activity,
  dockOverlayBreakpoint,
}: AppShellPageProps) {
  const [navOpen, setNavOpen] = useState(defaultNavOpen);
  const [dockOpen, setDockOpen] = useState(defaultDockOpen);

  return (
    <SidebarProvider
      open={navOpen}
      onOpenChange={setNavOpen}
      // `h-svh` + the provider's own `overflow-hidden` make `main` the scroll
      // container rather than the document, so the top bar never scrolls away
      // and the rails stay full height.
      className="h-svh"
      // `data-nav` / `data-dock` make the frame's state readable from CSS and
      // from a test without reaching into React state.
      data-nav={navOpen ? "expanded" : "collapsed"}
      data-dock={showDock && dockOpen ? "open" : "closed"}
    >
      {/* First focusable element in the document, before the rail: a keyboard
          user bypasses the whole nav tree and lands in `<main>`. */}
      <SkipLink />

      <AppNavRail activePath={activePath} />

      {/* No `variant`, no `gutter`: the content column is FLUSH. See note 2 in
          the file header before "restoring" the floating card. */}
      <SidebarInset id="main-content" tabIndex={-1} className="min-w-0">
        <AppTopBar
          activePath={activePath}
          navOpen={navOpen}
          onNavOpenChange={setNavOpen}
          dockOpen={dockOpen}
          onDockOpenChange={setDockOpen}
          showDockToggle={showDock}
        />

        {/* `scroll="fill"` means PageShell owns no overflow of its own — the
            port below does, and therefore carries the keyboard-operable tab
            stop (WCAG 2.1.1, axe `scrollable-region-focusable`). */}
        <PageShell
          scroll="fill"
          width="full"
          className="px-0 py-0 sm:px-0 lg:px-0"
          contentClassName="flex h-full min-h-0 flex-col"
        >
          <div
            data-slot="app-shell-content"
            tabIndex={0}
            // `focus-ring-inset`, not `focus-ring`: both of the plain rung's
            // layers are drawn OUTSIDE the element's box, and this port's
            // ancestor carries `overflow-hidden` — so the ring and its contour
            // were clipped away and a keyboard user got no indicator at all on
            // a deliberately focusable region.
            className="min-h-0 flex-1 overflow-y-auto px-4 py-6 focus-ring-inset sm:px-6 lg:px-8"
          >
            {emptyContent ? (
              /* A LABELLED slot, not a blank canvas. `emptyContent` exists to
               * show what the shell contributes on its own — but rendering
               * literally nothing under the top bar reads as a broken screen
               * rather than as an empty one, and the copier cannot see where
               * their own screen is meant to go. The dashed outline is the
               * only place in this block that is deliberately not a resting
               * surface: it marks a hole, so it must not look like a card. */
              <div
                data-slot="app-shell-content-placeholder"
                className="flex h-full min-h-40 items-center justify-center rounded-xl border border-dashed border-border-strong p-6 text-center text-body text-muted-foreground"
              >
                Your screen renders here.
              </div>
            ) : (
              <ConsoleOverview
                loading={loading}
                metrics={metrics}
                runs={runs}
                activity={activity}
              />
            )}
          </div>
        </PageShell>
      </SidebarInset>

      {/* A SIBLING of `SidebarInset`, so the `aside` lands beside `<main>`
          rather than inside it. Closed means zero width, not a residual strip. */}
      {showDock ? (
        <SideDock
          title="Assistant"
          description="Details, alerts and runbooks for what is on screen."
          open={dockOpen}
          onOpenChange={setDockOpen}
          overlayBreakpoint={dockOverlayBreakpoint}
        >
          <AssistantDockBody alertCount={2} />
        </SideDock>
      ) : null}
    </SidebarProvider>
  );
}
