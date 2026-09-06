/**
 * The dashboard app shell — one collapsible nav rail beside a floating inset
 * content surface. The classic left-sidebar dashboard, for a product whose whole
 * navigation fits in one tree.
 *
 * ONE `SidebarProvider`, not three. The flagship shell (`app-shell`) runs a
 * provider per collapsible zone because it has three of them; here the rail is
 * the only one, so a single `frame="app"` provider owns the state — which is
 * what makes `SidebarTrigger` in the top bar and the frame's ⌘B/Ctrl+B shortcut
 * the same control instead of two things that can disagree.
 *
 * The floating surface comes from composing BOTH inset mechanisms: `variant="inset"`
 * on the provider (which paints the `bg-sidebar` frame ground) and on the left
 * `Sidebar`. `SidebarInset` derives its ancestor-scoped and peer-scoped margins
 * from the same `gutter` value, so the two selectors emit identical declarations
 * and there is no stylesheet-order race (sidebar.tsx, `SidebarInsetGutter`). The
 * default `gutter="auto"` is exactly the geometry this layout wants — a margin on
 * every side that reopens the leading edge when the rail collapses — so no
 * `gutter` prop is passed.
 */
"use client";

import { SidebarInset, SidebarProvider, SkipLink } from "@elabs-ai/components-ui";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardTopBar } from "./dashboard-top-bar";
import {
  StorefrontOverview,
  type ActivityEntry,
  type RevenuePoint,
  type StoreMetric,
} from "./storefront-overview";

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
}: DashboardShellProps) {
  return (
    // The provider IS the frame here: `variant="inset"` gives it the
    // `bg-sidebar` ground and `group/sidebar-wrapper`, and it already carries
    // `flex min-h-svh w-full`. `h-svh` pins it to the viewport so the scroll
    // port below owns the overflow instead of the page.
    <SidebarProvider variant="inset" defaultOpen={defaultSidebarOpen} className="h-svh">
      <SkipLink />

      <DashboardSidebar activePath={activePath} />

      {/* `SidebarInset` renders the `<main>`, so the shell's one landmark and the
          skip link's target are the same element. `tabIndex={-1}` is what makes
          the skip actually move focus rather than only the scroll position. */}
      <SidebarInset id="main-content" tabIndex={-1} className="min-w-0 overflow-hidden">
        <DashboardTopBar activePath={activePath} />

        <div
          data-slot="dashboard-content"
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
            />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
