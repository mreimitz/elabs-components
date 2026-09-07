/**
 * The dashboard app shell — a nav rail on the left, a flush content column, and
 * a PERMANENT details rail on the right. The classic left-sidebar briefing
 * screen, for a product whose whole navigation fits in one tree.
 *
 * Two things distinguish it from the flagship, and both are the point:
 *
 * 1. **The right-hand panel is `ContextRail`, not `SideDock`.** It never leaves:
 *    collapsed it is a 48px icon strip that IS its own section switcher, so the
 *    details of what you are looking at are always one glance away. The flagship
 *    uses the other pattern — a dock you summon, which slides fully to zero. Pick
 *    by whether the panel is something you SUMMON or something that is always
 *    there. Both ship; neither is the default answer.
 * 2. **The content surface is an INSET card**, not flush: `variant="inset"` on
 *    the provider (which paints the `bg-sidebar` frame ground) AND on the left
 *    `Sidebar`. `SidebarInset` derives its ancestor-scoped and peer-scoped
 *    margins from the same `gutter` value, so the two selectors emit identical
 *    declarations and there is no stylesheet-order race (sidebar.tsx,
 *    `SidebarInsetGutter`). The default `gutter="auto"` is the geometry this
 *    layout wants — a gutter on top, bottom and the trailing edge (against the
 *    details rail), and the leading one reopening when the nav rail collapses.
 *    The flagship shell is the FLUSH member of this family; this one is the
 *    floating card. Going flush here is a one-prop change on both.
 *
 * ONE `SidebarProvider` for the nav rail, because it is the only collapsible
 * `Sidebar` here — which is what makes `SidebarTrigger` in the top bar and the
 * frame's ⌘B/Ctrl+B shortcut the same control instead of two things that can
 * disagree. The details rail carries its own state, driven from this file.
 */
"use client";

import { useState } from "react";
import { BookOpen, Info, TriangleAlert } from "lucide-react";
import {
  ContextRail,
  SidebarInset,
  SidebarProvider,
  SkipLink,
  type ContextRailSection,
} from "@elabs-ai/components-ui";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardTopBar } from "./dashboard-top-bar";
import {
  StorefrontOverview,
  type ActivityEntry,
  type RevenuePoint,
  type StoreMetric,
} from "./storefront-overview";

/**
 * The details rail's sections. First one is what the rail opens on.
 *
 * The ink is SIDEBAR ink, not canvas ink. `ContextRail` grounds both of its
 * branches on `bg-sidebar` (the docked `Sidebar` and the narrow `Sheet` alike),
 * and in the `light` reference theme that chrome ground is DARK — so canvas
 * `text-muted-foreground` on it is a real 1.4.3 contrast failure. Content handed
 * to a chrome surface reaches for the chrome's own ink pair.
 */
function detailSections(alertCount: number): ContextRailSection[] {
  return [
    {
      id: "details",
      label: "Details",
      icon: <Info />,
      content: (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
          <dt className="text-sidebar-muted-foreground">Storefront</dt>
          <dd className="text-sidebar-foreground">Northwind Supply</dd>
          <dt className="text-sidebar-muted-foreground">Plan</dt>
          <dd className="text-sidebar-foreground">Growth</dd>
          <dt className="text-sidebar-muted-foreground">Currency</dt>
          <dd className="text-sidebar-foreground">EUR</dd>
          <dt className="text-sidebar-muted-foreground">Reporting window</dt>
          <dd className="text-sidebar-foreground">Last 24 hours</dd>
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
            <p className="text-sidebar-foreground">Refund rate above the 4% guardrail</p>
            <p className="text-meta text-sidebar-muted-foreground">Raised 06:12 · unacknowledged</p>
          </li>
          <li>
            <p className="text-sidebar-foreground">Two SKUs fell below reorder point</p>
            <p className="text-meta text-sidebar-muted-foreground">Raised 04:30 · needs a buyer</p>
          </li>
        </ul>
      ),
    },
    {
      id: "notes",
      label: "Notes",
      icon: <BookOpen />,
      content: (
        <p className="text-body text-sidebar-muted-foreground">
          Runbooks and reporting notes for this storefront appear here.
        </p>
      ),
    },
  ];
}

export interface DashboardShellProps {
  /** Current route, forwarded to the rail for the active-state indicator. */
  activePath?: string;
  /** Render the chrome with an EMPTY content slot — the frame, nothing in it. */
  emptyContent?: boolean;
  /** Nav rail starts expanded. @default true */
  defaultSidebarOpen?: boolean;
  /** No renderable data yet — every region shows its own layout-shaped skeleton. */
  loading?: boolean;
  /** Tenant name shown in the screen's standfirst. */
  scope?: string;
  /* ---- Data pass-throughs. A copy-own block takes data in and renders chrome
     out; each of these defaults to the demo fixture beside it, so the block
     renders believably before you have wired anything up. ---- */
  /** Tiles of the metric row. @default DEMO_METRICS */
  metrics?: StoreMetric[];
  /** Points of the revenue trend. @default DEMO_REVENUE */
  revenue?: RevenuePoint[];
  /** Entries of the overnight activity feed. @default DEMO_ACTIVITY */
  activity?: ActivityEntry[];
  /** Details rail starts expanded. @default false — it rests as its icon strip. */
  defaultDetailsOpen?: boolean;
  /**
   * Viewport width below which the rail hands its BODY to a `Sheet` while
   * keeping its icon strip. Forwarded verbatim to `ContextRail`; the default
   * (768) is the rail's own.
   */
  detailsOverlayBreakpoint?: number;
}

export default function DashboardShell({
  activePath = "/",
  emptyContent = false,
  defaultSidebarOpen = true,
  loading = false,
  scope,
  metrics,
  revenue,
  activity,
  defaultDetailsOpen = false,
  detailsOverlayBreakpoint,
}: DashboardShellProps) {
  const [detailsOpen, setDetailsOpen] = useState(defaultDetailsOpen);

  return (
    // No `data-slot` of the shell's own here. `SidebarProvider` declares
    // `data-slot="sidebar-wrapper"` and spreads `...props` LAST, so passing one
    // in would DELETE the library's slot on this instance — and a copy-own
    // block is the thing people copy, so it must not teach that. The frame stays
    // addressable through the base slot.
    // `h-svh` pins the frame to the viewport so the scroll port below owns the
    // overflow instead of the page.
    <SidebarProvider
      variant="inset"
      defaultOpen={defaultSidebarOpen}
      className="h-svh"
      data-details={detailsOpen ? "expanded" : "collapsed"}
    >
      <SkipLink />

      <DashboardSidebar activePath={activePath} />

      {/* `SidebarInset` renders the `<main>`, so the shell's one landmark and the
          skip link's target are the same element. `tabIndex={-1}` is what makes
          the skip actually move focus rather than only the scroll position. */}
      <SidebarInset id="main-content" tabIndex={-1} className="min-w-0 overflow-hidden">
        <DashboardTopBar activePath={activePath} />

        <div
          data-slot="dashboard-shell-content"
          tabIndex={0}
          // `focus-ring-inset`, not `focus-ring`: both of the plain rung's layers
          // are drawn OUTSIDE the element's box, and this port's parent carries
          // `overflow-hidden` — so the ring and its contour would be clipped away
          // and a keyboard user would get no indicator at all on a deliberately
          // focusable region (WCAG 2.1.1, axe `scrollable-region-focusable`).
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 focus-ring-inset sm:px-6 lg:px-8"
        >
          {emptyContent ? null : (
            <StorefrontOverview
              scope={scope}
              loading={loading}
              metrics={metrics}
              revenue={revenue}
              activity={activity}
              // The KPI row reflows when the details rail takes room from this
              // column. `MetricGrid`'s own column classes are VIEWPORT media
              // queries, so they cannot see a sibling panel opening beside them
              // — at a 1440px browser width the four-wide grid survives the
              // rail's ~280px and every tile title clips mid-word. The shell is
              // the one place that knows both facts, so it is the one place
              // that decides.
              metricColumns={detailsOpen ? 2 : 4}
            />
          )}
        </div>
      </SidebarInset>

      {/* Permanent furniture, and a SIBLING of `<main>` — a complementary
          landmark belongs beside the main landmark, never inside it. Collapsed
          it keeps its 48px icon strip, which is also its section switcher. */}
      <ContextRail
        sections={detailSections(2)}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        overlayBreakpoint={detailsOverlayBreakpoint}
        // The rail is full-bleed chrome while the content column is an INSET
        // card, so the card's own top gutter (`mt-2`) starts its top bar 8px
        // lower than the rail's header band. This pays that 8px back, so the two
        // headers sit on one line. `md:`, because the gutter it answers to is
        // `md:`-gated too (`SidebarInset`) — below that width there is no card
        // and nothing to line up with.
        //
        // Per PRESENTATION, because the two branches start from different
        // padding and `className` lands on whichever one is mounted. The wide
        // branch's header band starts flush, so 8px puts its 56px band's centre
        // line on the card's top bar. The narrow strip already carries `pt-3`
        // for its own icon, and a `md:pt-2` would REPLACE that 12px with 8px
        // rather than add to it — its first icon would centre at 24px against
        // the bar's 36px. `pt-5` is that strip's own 12px plus the same 8px.
        // Only reachable when a caller raises `detailsOverlayBreakpoint` above
        // 768px, which is exactly why it is easy to get wrong.
        className="md:data-[presentation=wide]:pt-2 md:data-[presentation=narrow]:pt-5"
      />
    </SidebarProvider>
  );
}
