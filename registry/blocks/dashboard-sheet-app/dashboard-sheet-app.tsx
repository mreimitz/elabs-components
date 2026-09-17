/**
 * Dashboard sheet app (copy-owned block) — the installable version of the canonical
 * full-screen, user-editable dashboard (`docs/playbooks/dashboard.md`'s "editable
 * dashboard sheet" archetype; single source of truth for the shape:
 * `packages/charts/src/templates-dashboard-sheet.stories.tsx`).
 *
 * This block additionally registers the three cross-package tile kinds
 * (`dashboard-tile-table`, `dashboard-tile-chat`, `dashboard-tile-process-map`) beside
 * the built-in kinds `@elabs-ai/components-charts/dashboard` ships, so the sheet can
 * place a `table`, `chat` or `process-map` tile from the asset panel without a host
 * writing any registration code itself.
 *
 * Depends on installed @elabs-ai/components-charts (+ its /dashboard subpath),
 * @elabs-ai/components-ui, @elabs-ai/components-icons, and the three
 * `dashboard-tile-*` blocks (`registryDependencies`).
 */
"use client";

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
  type DashboardSpec,
} from "@elabs-ai/components-charts/dashboard";
import { tableTileKind } from "@/components/dashboard-tile-table/dashboard-tile-table";
import { chatTileKind } from "@/components/dashboard-tile-chat/dashboard-tile-chat";
import { processMapTileKind } from "@/components/dashboard-tile-process-map/dashboard-tile-process-map";

const nav = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "dashboards", label: "Dashboards", icon: BarChart3 },
  { id: "team", label: "Team", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

const TILES = [...Object.values(builtInTiles), tableTileKind, chatTileKind, processMapTileKind];

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
      id: "table-orders",
      kind: "table",
      title: "Orders by month",
      layout: { x: 16, y: 0, w: 8, h: 9 },
      content: {
        field: "month",
        columns: [
          { id: "month", header: "Month" },
          { id: "revenue", header: "Revenue" },
        ],
        rows: [
          { month: "Jan", revenue: 12 },
          { month: "Feb", revenue: 18 },
          { month: "Mar", revenue: 15 },
        ],
      },
    },
  ],
};

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

export function DashboardSheetApp() {
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
        <DashboardProvider spec={STARTER_SPEC} tiles={TILES}>
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
