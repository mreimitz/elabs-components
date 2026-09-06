/**
 * The flagship app shell — four zones (nav rail, optional list column, content,
 * context rail) driven by one metrics module. See `shell-metrics.ts` for the
 * width/offset pattern and `nav-items.ts` for the router-agnostic nav data.
 *
 * Three sibling `SidebarProvider`s, one per collapsible zone — a single shared
 * provider would collapse them together, since it holds exactly one `open` flag.
 * Only the content zone's provider uses `frame="app"` (the ADR 0035 default); the
 * nav and list zones use `frame="nested"` so they don't ALSO register the global
 * ⌘B/Ctrl+B listener or write the `sidebar_state` cookie — a second `frame="app"`
 * provider anywhere in the document is an unguarded collision (ADR 0035 §4
 * "Watch for"), so this shell keeps exactly one.
 *
 * The zone state lives HERE, not in the providers, because three separate
 * consumers read it: the `data-nav`/`data-list`/`data-context` attributes on the
 * root (which anything in the tree can select on), `shellStyle`'s CSS custom
 * properties, and the top bar's two toggle buttons — which sit inside
 * `SidebarInset` and therefore inside the CONTEXT zone's provider, where a
 * `SidebarTrigger` would toggle the wrong rail. See `app-top-bar.tsx`.
 */
"use client";

import { useState } from "react";
import { BookOpen, Info, TriangleAlert } from "lucide-react";
import {
  ContextRail,
  PageShell,
  SidebarInset,
  SidebarProvider,
  SkipLink,
  type ContextRailSection,
} from "@elabs-ai/components-ui";
// This file installs at `app/(app)/page.tsx` (see the `fileOverrides` entry in
// registry.items.json) — outside `components/app-shell/`, so a relative import to a
// sibling in this source folder wouldn't resolve in the install tree. Use the
// consumer-side alias instead (see .claude/rules/registry.md "One copy of shared code").
import { AppNavRail } from "@/components/app-shell/app-nav-rail";
import { AppTopBar } from "@/components/app-shell/app-top-bar";
import {
  AppListColumn,
  DEMO_PIPELINES,
  type PipelineSummary,
} from "@/components/app-shell/app-list-column";
import {
  ConsoleOverview,
  type ActivityEntry,
  type ConsoleMetric,
  type RunRow,
} from "@/components/app-shell/console-overview";
import { shellStyle, type ShellState } from "@/components/app-shell/shell-metrics";

/**
 * The right-hand rail's sections. First one is what the rail opens on.
 *
 * The ink is SIDEBAR ink, not canvas ink. `ContextRail` grounds both of its
 * branches on `bg-sidebar` (the docked `Sidebar` and the narrow `Sheet` alike),
 * and in the `light` reference theme that chrome ground is DARK — so canvas
 * `text-muted-foreground` on it measures 2.29:1, a real 1.4.3 failure axe
 * catches in `ContextRailOpen`. Content handed to a chrome surface reaches for
 * the chrome's own ink pair.
 */
function contextSections(alertCount: number): ContextRailSection[] {
  return [
    {
      id: "details",
      label: "Details",
      icon: <Info />,
      content: (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
          <dt className="text-sidebar-muted-foreground">Owner</dt>
          <dd className="text-sidebar-foreground">Ada Okonkwo</dd>
          <dt className="text-sidebar-muted-foreground">Schedule</dt>
          <dd className="text-sidebar-foreground">Every 15 minutes</dd>
          <dt className="text-sidebar-muted-foreground">Retention</dt>
          <dd className="text-sidebar-foreground">90 days</dd>
          <dt className="text-sidebar-muted-foreground">Last change</dt>
          <dd className="text-sidebar-foreground">2 days ago</dd>
        </dl>
      ),
    },
    {
      id: "alerts",
      label: "Alerts",
      icon: <TriangleAlert />,
      count: alertCount,
      content: (
        <ul className="space-y-3 text-body">
          <li>
            <p className="text-sidebar-foreground">Schema drift on Orders ingest</p>
            <p className="text-meta text-sidebar-muted-foreground">Raised 06:12 · unacknowledged</p>
          </li>
          <li>
            <p className="text-sidebar-foreground">Row delta above the 5% guardrail</p>
            <p className="text-meta text-sidebar-muted-foreground">
              Raised 05:48 · waiting on approval
            </p>
          </li>
        </ul>
      ),
    },
    {
      id: "docs",
      label: "Docs",
      icon: <BookOpen />,
      content: (
        <p className="text-body text-sidebar-muted-foreground">
          Runbooks and schema notes for the selected pipeline appear here.
        </p>
      ),
    },
  ];
}

export interface AppShellPageProps {
  /** Current route, forwarded to the nav rail for the active-state indicator. */
  activePath?: string;
  /** Render the chrome with an EMPTY content slot — the frame, nothing in it. */
  emptyContent?: boolean;
  /** Nav rail starts expanded. @default true */
  defaultNavOpen?: boolean;
  /** Context rail starts expanded. @default false */
  defaultContextOpen?: boolean;
  /** Mount the optional list column at all (zone D8). @default true */
  showList?: boolean;
  /** No renderable data yet — every zone shows its own layout-shaped skeleton. */
  loading?: boolean;
  /* ---- Data pass-throughs. A copy-own block takes data in and renders chrome
     out; every one of these defaults to the demo fixture beside it, so the
     block renders believably before you have wired anything up. ---- */
  /** Rows for the list column. @default DEMO_PIPELINES */
  pipelines?: PipelineSummary[];
  /** Tiles of the console's metric row. @default DEMO_METRICS */
  metrics?: ConsoleMetric[];
  /** Rows of the console's runs table. @default DEMO_RUNS */
  runs?: RunRow[];
  /** Entries of the console's activity timeline. @default DEMO_ACTIVITY */
  activity?: ActivityEntry[];
  /**
   * Below this viewport width the context rail mounts a 48px strip plus a
   * `Sheet` instead of a `Sidebar`. Forwarded verbatim to `ContextRail`; the
   * default (768) is the rail's own. Raise it when a wide layout should still
   * hand the rail's body to an overlay.
   */
  contextOverlayBreakpoint?: number;
}

export default function AppShellPage({
  activePath = "/",
  emptyContent = false,
  defaultNavOpen = true,
  defaultContextOpen = false,
  showList = true,
  loading = false,
  pipelines = DEMO_PIPELINES,
  metrics,
  runs,
  activity,
  contextOverlayBreakpoint,
}: AppShellPageProps) {
  const [navOpen, setNavOpen] = useState(defaultNavOpen);
  const [contextOpen, setContextOpen] = useState(defaultContextOpen);
  const [selectedId, setSelectedId] = useState<string | undefined>(pipelines[0]?.id);

  // The list zone is presence, not a collapse: it either exists for this screen
  // or it doesn't. Keeping it in `ShellState` is what makes `--shell-list-w`
  // (and every offset derived from it) close up on its own when it doesn't.
  const state: ShellState = { nav: navOpen, list: showList, context: contextOpen };
  const selected = pipelines.find((item) => item.id === selectedId);

  return (
    <div
      data-nav={navOpen ? "expanded" : "collapsed"}
      data-list={showList ? "expanded" : "collapsed"}
      data-context={contextOpen ? "expanded" : "collapsed"}
      style={shellStyle(state)}
      className="flex h-svh w-full bg-sidebar text-foreground"
    >
      <SkipLink />

      <SidebarProvider open={navOpen} onOpenChange={setNavOpen} frame="nested">
        <AppNavRail activePath={activePath} />
      </SidebarProvider>

      <SidebarProvider frame="nested">
        {showList ? (
          <AppListColumn
            items={pipelines}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={loading}
          />
        ) : null}
      </SidebarProvider>

      <SidebarProvider
        open={contextOpen}
        onOpenChange={setContextOpen}
        frame="app"
        variant="inset"
        // The provider is a flex CHILD here, beside the two zones above, so it
        // must be allowed to shrink; `min-w-0` is what lets the content column
        // truncate instead of pushing the rails off-screen.
        className="min-w-0 flex-1"
      >
        <SidebarInset
          id="main-content"
          tabIndex={-1}
          gutter={{ start: true, bottom: true }}
          className="min-w-0 overflow-hidden"
        >
          <AppTopBar
            activePath={activePath}
            navOpen={navOpen}
            onNavOpenChange={setNavOpen}
            contextOpen={contextOpen}
            onContextOpenChange={setContextOpen}
            unreadCount={2}
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
              // ancestor `SidebarInset` carries `overflow-hidden` — so the ring
              // and its contour were clipped away and a keyboard user got no
              // indicator at all on a deliberately focusable region. The inset
              // rung is the one the theming rule specifies for exactly this.
              className="min-h-0 flex-1 overflow-y-auto px-4 py-6 focus-ring-inset sm:px-6 lg:px-8"
            >
              {emptyContent ? null : (
                <ConsoleOverview
                  scope={selected?.name}
                  loading={loading}
                  metrics={metrics}
                  runs={runs}
                  activity={activity}
                />
              )}
            </div>
          </PageShell>
        </SidebarInset>

        <ContextRail
          sections={contextSections(2)}
          open={contextOpen}
          onOpenChange={setContextOpen}
          overlayBreakpoint={contextOverlayBreakpoint}
        />
      </SidebarProvider>
    </div>
  );
}
