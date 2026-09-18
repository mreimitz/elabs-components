/**
 * Dashboard sheet template — the canonical full-screen, user-editable dashboard
 * (docs/playbooks/dashboard.md’s “editable dashboard sheet” archetype): app nav +
 * `DashboardToolbar` (mode switch, undo/redo, add, save) + `DashboardSelectionBar` +
 * `DashboardAssetPanel` / `DashboardPropertiesPanel` + `DashboardSheet`, all sharing one
 * `DashboardProvider`. This story is the single source of truth: `pnpm gen` derives the
 * consumer template source (`docs/playbooks/templates/dashboard-sheet.tsx`) from it.
 * Verify across every theme with globals=theme:<slug>.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { useState } from "react";
import {
  NavUser,
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import type { DashboardSpec } from "./dashboard/core/spec";
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
} from "./dashboard";

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
        <SidebarFooter>
          <NavUser user={{ name: "Avery Rao", email: "avery@example.com" }} />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex h-header shrink-0 items-center gap-2 border-b px-4">
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

const meta = {
  title: "Patterns/Templates/Dashboard Sheet",
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <DashboardSheetTemplate />,
  play: async ({ canvasElement, canvas }) => {
    // Renders the whole chrome around one shared DashboardProvider: nav, toolbar,
    // selection bar, both docks and the sheet tiles.
    await expect(canvas.getByRole("heading", { name: "Dashboards" })).toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "View" })).toBeInTheDocument();
    await expect(canvas.getByText("Revenue by month")).toBeInTheDocument();
    // "Total revenue" appears twice by design (the tile's own chrome title, plus the
    // metric content's own label) — assert the metric's actual value instead, which is unique.
    await expect(canvas.getByText("$45,000")).toBeInTheDocument();

    // Every tile root carries data-tile-kind (.claude/rules/dashboard.md), so the
    // starter spec 4 tiles are countable straight from the DOM with no hidden probe.
    // Scoped to the sheet's own `data-slot="dashboard-tile"` wrapper — the built-in
    // `filter` kind also stamps `data-tile-kind` on its inner root, which an unscoped
    // query would double-count.
    const tileSelector = '[data-slot="dashboard-tile"][data-tile-kind]';
    const tilesBefore = canvasElement.querySelectorAll(tileSelector).length;
    await expect(tilesBefore).toBe(4);

    // Toggling Edit mounts the edit layer and the asset panel Add affordance;
    // adding a library tile grows the sheet by one and pushes one undo step —
    // spec.tiles.length 4 -> 5, history.past 0 -> 1 (Undo goes from disabled to
    // enabled, since the toolbar reads history.canUndo off exactly that count).
    await userEvent.click(canvas.getByRole("radio", { name: "Edit" }));
    await expect(canvas.getByRole("button", { name: "Undo" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "Add" }));

    // #432 regression: opening the Assets dock must never hide the host app’s
    // own Sidebar nav (wave-4-review-visual.md P0-1) — asserted geometrically,
    // not just "still in the DOM".
    const dashboardsNav = canvas.getByRole("button", { name: "Dashboards" });
    await expect(dashboardsNav).toBeVisible();
    const sidebarContainer = canvasElement.querySelector(
      '[data-slot="sidebar-container"]',
    ) as HTMLElement;
    const dockContainer = canvasElement.querySelector(
      '[data-dashboard-panel="assets"][data-slot="side-dock-container"]',
    ) as HTMLElement;
    // The immediate flex sibling that HOLDS the sheet (not the sheet’s own
    // root, which carries its own internal padding) — this is the element
    // whose left edge the dock’s flow spacer is actually reserving space
    // against.
    const canvasWrapper = (
      canvasElement.querySelector('[data-slot="dashboard-sheet"]') as HTMLElement
    ).parentElement as HTMLElement;
    // The open/close tween (`duration-base`) is still animating right after
    // the click — settle before measuring, the same way the SideDock Default
    // story waits for its own width tween to finish.
    await waitFor(() => {
      const dockRect = dockContainer.getBoundingClientRect();
      const sidebarRect = sidebarContainer.getBoundingClientRect();
      expect(dockRect.left).toBeGreaterThanOrEqual(sidebarRect.right);
    });
    const sidebarRect = sidebarContainer.getBoundingClientRect();
    const dockRect = dockContainer.getBoundingClientRect();
    const canvasRect = canvasWrapper.getBoundingClientRect();
    const overlaps =
      sidebarRect.left < dockRect.right &&
      dockRect.left < sidebarRect.right &&
      sidebarRect.top < dockRect.bottom &&
      dockRect.top < sidebarRect.bottom;
    await expect(overlaps).toBe(false);
    await expect(dockRect.left).toBeGreaterThanOrEqual(sidebarRect.right);
    await expect(Math.abs(canvasRect.left - dockRect.right)).toBeLessThanOrEqual(1);

    // P2 re-check (wave-4-review-visual.md): the dead gap is gone (asserted
    // above), but the "Month" tile is a FIXED `w:4`-of-24 grid column
    // competing with a real Sidebar (256px) AND this Assets dock (240px) at
    // 1280px — genuinely narrow, not a regression this fix owns. Text
    // integrity survives truncation either way (`truncate` is CSS-only, per
    // `wave-4-review-visual.md`’s own micro-typography check); this does NOT
    // assert non-truncation — see `wave-4-fix-result.md` for the measured
    // widths and the "report, don’t hack" call.
    const monthTitle = canvas.getByText("Month", {
      selector: '[data-slot="dashboard-tile-header-title"]',
    });
    await expect(monthTitle.textContent).toBe("Month");

    await userEvent.click(canvas.getByRole("option", { name: "Heading" }));
    const tilesAfter = canvasElement.querySelectorAll(tileSelector).length;
    await expect(tilesAfter).toBe(tilesBefore + 1);
    await expect(canvas.getByRole("button", { name: "Undo" })).toBeEnabled();
  },
};
