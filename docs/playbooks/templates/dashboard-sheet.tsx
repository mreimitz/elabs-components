/* GENERATED from packages/charts/src/templates-dashboard-sheet.stories.tsx by pnpm gen — do not edit. */
/* Full-screen dashboard-sheet template (single source of truth: the Storybook story). */

/**
 * Dashboard sheet template — the canonical full-screen, user-editable dashboard
 * (docs/playbooks/dashboard.md’s “editable dashboard sheet” archetype): app nav +
 * `DashboardToolbar` (mode switch, undo/redo, add, save) + `DashboardSelectionBar` +
 * `DashboardAssetPanel` / `DashboardPropertiesPanel` + `DashboardSheet`, all sharing one
 * `DashboardProvider`. This story is the single source of truth: `pnpm gen` derives the
 * consumer template source (`docs/playbooks/templates/dashboard-sheet.tsx`) from it.
 * Verify across every theme with globals=theme:<slug>.
 */
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@elabs-ai/components-ui";
import { AppIcon } from "@elabs-ai/components-icons";
import { BarChart3, Home, Settings, Users } from "lucide-react";
import type { DashboardSpec } from "@elabs-ai/components-charts";
import {
  DashboardAssetPanel,
  DashboardProvider,
  DashboardPropertiesPanel,
  DashboardSelectionBar,
  DashboardSheet,
  DashboardToolbar,
  builtInTiles,
  useDashboard,
  useDashboardActions,
} from "@elabs-ai/components-charts";

const nav = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "dashboards", label: "Dashboards", icon: BarChart3 },
  { id: "team", label: "Team", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

/**
 * A small starter sheet: a chart and a metric, both bound to `month`, plus a
 * `filter` tile so a viewer can narrow the selection and see both tiles react —
 * the same tri-state selection every tile kind shares (.claude/rules/dashboard.md).
 */
const STARTER_SPEC: DashboardSpec = {
  version: 1,
  id: "revenue-overview",
  title: "Revenue overview",
  grid: { mode: "fit", columns: 24, rows: 12, gap: 8 },
  tiles: [
    {
      id: "filter-month",
      kind: "filter",
      title: "Month",
      layout: { x: 0, y: 0, w: 4, h: 9 },
      content: {
        field: "month",
        label: "Month",
        values: [
          { value: "Jan", count: 12 },
          { value: "Feb", count: 18 },
          { value: "Mar", count: 15 },
        ],
      },
    },
    {
      id: "chart-revenue",
      kind: "chart",
      title: "Revenue by month",
      layout: { x: 4, y: 0, w: 12, h: 9 },
      content: {
        type: "bar",
        x: "month",
        series: ["revenue"],
        data: [
          { month: "Jan", revenue: 12 },
          { month: "Feb", revenue: 18 },
          { month: "Mar", revenue: 15 },
        ],
      },
    },
    {
      id: "metric-total",
      kind: "metric",
      title: "Total revenue",
      layout: { x: 16, y: 0, w: 8, h: 4 },
      content: { label: "Total revenue", value: "$45,000", delta: "+12%", deltaDirection: "up" },
    },
    {
      id: "text-note",
      kind: "text",
      title: "Note",
      layout: { x: 16, y: 4, w: 8, h: 5 },
      content: { body: "Revenue is recognised on delivery." },
    },
  ],
};

/**
 * The toolbar Add button and a tile Edit menu item open the asset/properties panels
 * through `actions.setPanel` (.claude/rules/dashboard.md chrome slice) — this wires
 * both `SideDock`s to that same store state so they actually respond, and writes back
 * on a manual close so the two stay in sync either direction.
 */
function DashboardChrome() {
  const assetsOpen = useDashboard((s) => s.ui.assets);
  const propertiesOpen = useDashboard((s) => s.ui.properties);
  const actions = useDashboardActions();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DashboardToolbar />
      <DashboardSelectionBar />
      <div className="flex min-h-0 flex-1">
        <DashboardAssetPanel
          open={assetsOpen}
          onOpenChange={(open) => actions.setPanel("assets", open)}
          minWidth={240}
          defaultWidth={240}
          minContentWidth={360}
        />
        <div className="min-w-0 flex-1 overflow-auto p-2">
          <DashboardSheet renderAll />
        </div>
        <DashboardPropertiesPanel
          open={propertiesOpen}
          onOpenChange={(open) => actions.setPanel("properties", open)}
          minWidth={280}
          defaultWidth={280}
          minContentWidth={360}
        />
      </div>
    </div>
  );
}

function DashboardSheetTemplate() {
  const [active, setActive] = useState("dashboards");
  const activeLabel = nav.find((n) => n.id === active)?.label ?? active;
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 py-2">
          <div className="flex items-center gap-2">
            <AppIcon height={20} aria-hidden />
            <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
              Analytics
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((n) => (
                  <SidebarMenuItem key={n.id}>
                    <SidebarMenuButton
                      isActive={active === n.id}
                      tooltip={n.label}
                      onClick={() => setActive(n.id)}
                    >
                      <n.icon aria-hidden="true" />
                      <span>{n.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <h1 className="text-body font-medium">{activeLabel}</h1>
        </header>
        <DashboardProvider spec={STARTER_SPEC} tiles={builtInTiles}>
          {/* Every tile chrome title renders as an h3 (dashboard-tile.tsx) — this sr-only h2
           * keeps the page's heading order unbroken (h1 page title -> h2 sheet title -> h3
           * tile titles) without adding visible chrome. */}
          <h2 className="sr-only">{STARTER_SPEC.title}</h2>
          <DashboardChrome />
        </DashboardProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
