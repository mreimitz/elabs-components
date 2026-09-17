import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import type { BookmarkSpec, DashboardSpec, WorkbookSpec } from "../core/spec";
import {
  DEFAULT_DASHBOARD_LABELS,
  DashboardSheet,
  createTileRegistry,
  useDashboard,
  useDashboardActions,
  type DashboardTileKind,
  type DashboardTileProps,
} from "../dashboard-sheet";
import { DashboardContext, type DashboardContextValue } from "../dashboard-sheet/use-dashboard";
import { builtInTiles, withBuiltInTiles } from "../tiles";
import { DashboardWorkbook } from "./dashboard-workbook";
import { useWorkbook } from "./use-workbook";
import { WorkbookNav } from "./workbook-nav";

const REGIONS = ["EMEA", "APAC"];

function overviewSheet(): DashboardSpec {
  return {
    version: 1,
    id: "sheet-1",
    title: "Overview",
    grid: { mode: "fit", columns: 12, rows: 6 },
    tiles: [
      {
        id: "region-chart",
        kind: "chart",
        layout: { x: 0, y: 0, w: 8, h: 6 },
        content: {
          type: "bar",
          x: "Region",
          series: ["Revenue"],
          data: REGIONS.map((Region, i) => ({ Region, Revenue: 10 + i * 4 })),
        },
        // The interaction graph (RM-082, `core/interactions.ts`) routes a click through
        // `emits.selection`; the stock filter tile writes globally instead, so a `chart` tile
        // is the emitter a drill needs.
        emits: { selection: ["Region"] },
      },
      {
        id: "overview-note",
        kind: "text",
        layout: { x: 8, y: 0, w: 4, h: 2 },
        content: { body: "Pick a region — it drills into **Detail**." },
        // `resolveInteractions` only resolves a `to: "*"` pair against a tile that DECLARES
        // `consumes.selection` — a drill-only sheet still needs one other real graph member
        // for the wildcard rule to attach the drill effect to; this note is it.
        consumes: { selection: true },
      },
    ],
    interactions: [
      {
        from: "region-chart",
        to: "*",
        effect: { drill: { sheetId: "sheet-2", carry: ["Region"] } },
      },
    ],
  };
}

function detailSheet(): DashboardSpec {
  return {
    version: 1,
    id: "sheet-2",
    title: "Detail",
    grid: { mode: "fit", columns: 12, rows: 6 },
    tiles: [
      {
        id: "region-filter",
        kind: "filter",
        layout: { x: 0, y: 0, w: 4, h: 4 },
        content: { field: "Region", values: [{ value: "EMEA" }, { value: "APAC" }] },
      },
      {
        id: "detail-note",
        kind: "text",
        layout: { x: 4, y: 0, w: 8, h: 2 },
        content: { body: "Detail sheet." },
      },
    ],
  };
}

function archivedSheet(): DashboardSpec {
  return {
    version: 1,
    id: "sheet-4",
    title: "Archived",
    grid: { mode: "fit", columns: 12, rows: 6 },
    tiles: [],
    showCondition: "false",
  };
}

const WORKBOOK: WorkbookSpec = {
  version: 1,
  id: "sales-workbook",
  title: "Sales",
  sheets: [overviewSheet(), detailSheet(), archivedSheet()],
};

const meta = {
  title: "Dashboard/Workbook/DashboardWorkbook",
  component: DashboardWorkbook,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DashboardWorkbook>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three sheets; "Archived" (`showCondition: "false"`) never reaches the nav. Clicking the
 * EMEA bar in "Overview"'s chart drills into "Detail" and carries EXACTLY `Region = ["EMEA"]`
 * there (RM-087 follow-up 1, F1: targeted by accessible name, not an OR across the domain, so
 * a bug that carries the wrong-but-in-domain region would fail this). */
export const Workbook: Story = {
  render: () => (
    <div className="h-[560px]">
      <DashboardWorkbook workbook={WORKBOOK} tiles={builtInTiles} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Only "Overview" and "Detail" reach the tablist — "Archived" is absent, not disabled.
    await expect(canvas.getByRole("tab", { name: "Overview" })).toBeInTheDocument();
    await expect(canvas.getByRole("tab", { name: "Detail" })).toBeInTheDocument();
    await expect(canvas.queryByRole("tab", { name: "Archived" })).toBeNull();

    // The EMEA bar specifically — the chart's keyboard path; the layer itself is
    // `pointer-events: none` (same activation pattern as
    // `dashboard-interactions-editor.stories.tsx`). Every datapoint target's accessible name
    // states its category (`defaultDatapointLabel`, `charts.md`), so `aria-label` containing
    // "EMEA" picks the one bar deterministically among the two in the domain.
    let emeaBar: HTMLElement | null = null;
    await waitFor(() => {
      const bars = canvasElement.querySelectorAll<HTMLElement>(
        '[data-tile-id="region-chart"] [data-slot="chart-datapoint-layer-target"]',
      );
      emeaBar =
        Array.from(bars).find((el) => (el.getAttribute("aria-label") ?? "").includes("EMEA")) ??
        null;
      expect(emeaBar).not.toBeNull();
    });
    emeaBar!.focus();
    await userEvent.keyboard("{Enter}");

    // Drilled to "Detail". The target's filter tile shows the carried selection as an EXACT
    // option name, "EMEA, selected" (`DEFAULT_FILTER_TILE_LABELS.valueState`,
    // `tiles/filter-tile.tsx`) — asserting this AND that "APAC, selected" is absent rules out
    // both "wrong region carried" and "both regions carried" bugs.
    await waitFor(async () => {
      await expect(canvas.getByRole("tab", { name: "Detail", selected: true })).toBeInTheDocument();
    });
    await waitFor(async () => {
      await expect(canvas.getByRole("option", { name: "EMEA, selected" })).toBeInTheDocument();
    });
    await expect(canvas.queryByRole("option", { name: "APAC, selected" })).toBeNull();

    // #429: the drill is a PROGRAMMATIC switch — focus moves to the new tab and the nav's own
    // live region announces it, quoted exactly.
    const detailTab = canvas.getByRole("tab", { name: "Detail" });
    await expect(document.activeElement).toBe(detailTab);
    const status = canvasElement.querySelector('[data-slot="workbook-nav-status"]');
    await expect(status?.textContent).toBe("Showing sheet Detail.");
  },
};

// ---------------------------------------------------------------------------------------------
// RM-087 follow-up 1, F2 + F3 — a bookmark's sheet switch + apply, and edit persistence + the
// dirty flag across a sheet switch, both proven in a real, driven-browser play.
// ---------------------------------------------------------------------------------------------

/** Shows its own layout and the sheet's dirty flag as plain text, and exposes a real button
 * that moves itself via the public `moveTile` store action (RM-081) — the same "public store
 * action" escape hatch `chrome/use-dashboard-shortcuts.test.tsx` uses, and the same shape as
 * `dashboard-workbook.test.tsx`'s jsdom probe tile, now driven through a real Storybook play
 * instead of `userEvent` against jsdom. */
function ProbeTile({ tile }: DashboardTileProps) {
  const dirty = useDashboard((s) => s.dirty);
  const actions = useDashboardActions();
  return (
    <div className="p-2 text-caption">
      <p data-testid={`probe-layout-${tile.id}`}>{`x:${tile.layout.x},y:${tile.layout.y}`}</p>
      <p data-testid={`probe-dirty-${tile.id}`}>{`dirty:${dirty}`}</p>
      <button
        type="button"
        onClick={() => actions.moveTile(tile.id, { x: tile.layout.x, y: tile.layout.y + 2 })}
      >
        {`Move ${tile.id}`}
      </button>
    </div>
  );
}

const probeTileKind: DashboardTileKind = {
  kind: "probe",
  label: "Probe",
  component: ProbeTile,
  defaultSize: { w: 2, h: 2 },
  minSize: { w: 1, h: 1 },
  capabilities: {},
  configForm: { formName: "probe", fields: [] },
  defaultContent: {},
};

const PROBE_WORKBOOK: WorkbookSpec = {
  version: 1,
  id: "probe-workbook",
  title: "Probe",
  sheets: [
    {
      version: 1,
      id: "sheet-1",
      title: "Overview",
      grid: { mode: "fit", columns: 12, rows: 6 },
      tiles: [
        { id: "layout-probe", kind: "probe", layout: { x: 0, y: 0, w: 2, h: 2 }, content: {} },
      ],
    },
    {
      version: 1,
      id: "sheet-2",
      title: "Detail",
      grid: { mode: "fit", columns: 12, rows: 6 },
      tiles: [],
    },
    {
      version: 1,
      id: "sheet-3",
      title: "Bookmarks",
      grid: { mode: "fit", columns: 12, rows: 6 },
      tiles: [
        {
          id: "bookmark-filter",
          kind: "filter",
          layout: { x: 0, y: 0, w: 4, h: 4 },
          content: { field: "Region", values: [{ value: "EMEA" }, { value: "APAC" }] },
        },
      ],
    },
  ],
};

declare global {
  interface Window {
    /** Installed by `WorkbookHarness` so the play below can call the real, unmodified
     * `applyWorkbookBookmark` directly — the same "exposed test hook" pattern
     * `edit/edit-layer.stories.tsx` uses for `window.__dashboardStore`. */
    __applyWorkbookBookmark?: (bookmark: BookmarkSpec) => void;
  }
}

/**
 * `DashboardWorkbook` never exposes `useWorkbook`'s own result externally — by design, it owns
 * sheet-switching internally. This test-only harness recomposes the exact same public pieces
 * `DashboardWorkbook` itself is built from (`useWorkbook`, `WorkbookNav`, `DashboardContext`,
 * `DashboardSheet`), so a play can call the real `applyWorkbookBookmark` — the function under
 * test — directly, without any product-code change.
 */
function WorkbookHarness({
  workbook,
  tiles,
}: {
  workbook: WorkbookSpec;
  tiles: DashboardTileKind[];
}) {
  const wb = useWorkbook({ workbook });
  const registry = useMemo(() => createTileRegistry(tiles), [tiles]);
  wb.getStore(wb.activeSheetId);
  if (typeof window !== "undefined") window.__applyWorkbookBookmark = wb.applyWorkbookBookmark;

  return (
    <div className="flex h-[420px] flex-col">
      <WorkbookNav
        sheets={wb.visibleSheets}
        activeSheetId={wb.activeSheetId}
        onActiveSheetChange={wb.setActiveSheetId}
        switchSignal={wb.programmaticSwitch}
      />
      <div className="min-h-0 flex-1">
        {wb.visitedSheetIds.map((sheetId) => {
          const sheet = workbook.sheets.find((candidate) => candidate.id === sheetId);
          if (!sheet) return null;
          const value: DashboardContextValue = {
            store: wb.getStore(sheetId),
            registry,
            labels: DEFAULT_DASHBOARD_LABELS,
            onNavigate: wb.onNavigate,
          };
          return (
            <DashboardContext.Provider key={sheetId} value={value}>
              <div hidden={sheetId !== wb.activeSheetId} className="h-full min-h-0">
                <DashboardSheet chrome={false} />
              </div>
            </DashboardContext.Provider>
          );
        })}
      </div>
    </div>
  );
}

/**
 * F3: moves `layout-probe` via the public `moveTile` action, switches to "Detail" and back to
 * "Overview", and asserts the moved coordinates AND the dirty flag both survived — quoted
 * before and after. F2: calls the real `applyWorkbookBookmark({ ..., sheetId: "sheet-3" })`
 * directly (the exposed test hook above) and asserts the "Bookmarks" tab becomes selected and
 * its filter tile shows the applied selection as an exact option name.
 */
export const BookmarkAndEditPersistence: Story = {
  render: () => (
    <WorkbookHarness workbook={PROBE_WORKBOOK} tiles={withBuiltInTiles([probeTileKind])} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // --- F3: edit persistence + dirty flag across a sheet switch ---------------------------
    await expect(await canvas.findByTestId("probe-layout-layout-probe")).toHaveTextContent(
      "x:0,y:0",
    );
    expect(canvas.getByTestId("probe-dirty-layout-probe")).toHaveTextContent("dirty:false");

    await userEvent.click(canvas.getByRole("button", { name: "Move layout-probe" }));
    await waitFor(() =>
      expect(canvas.getByTestId("probe-layout-layout-probe")).toHaveTextContent("x:0,y:2"),
    );
    expect(canvas.getByTestId("probe-dirty-layout-probe")).toHaveTextContent("dirty:true");

    await userEvent.click(canvas.getByRole("tab", { name: "Detail" }));
    await waitFor(() =>
      expect(canvas.getByRole("tab", { name: "Detail", selected: true })).toBeInTheDocument(),
    );

    await userEvent.click(canvas.getByRole("tab", { name: "Overview" }));
    await waitFor(() =>
      expect(canvas.getByRole("tab", { name: "Overview", selected: true })).toBeInTheDocument(),
    );
    // Quoted, after the round trip: the move and the dirty flag both survived.
    await expect(canvas.getByTestId("probe-layout-layout-probe")).toHaveTextContent("x:0,y:2");
    await expect(canvas.getByTestId("probe-dirty-layout-probe")).toHaveTextContent("dirty:true");

    // #429: the two tab clicks just above are DIRECT user interaction (never routed through
    // `onNavigate`/`applyWorkbookBookmark`) — the nav's live region must still be empty, quoted.
    const status = canvasElement.querySelector('[data-slot="workbook-nav-status"]');
    await expect(status?.textContent).toBe("");

    // --- F2: a sheetId-bearing bookmark switches sheets, then applies -----------------------
    expect(window.__applyWorkbookBookmark).toBeTypeOf("function");
    window.__applyWorkbookBookmark!({
      id: "q3-emea",
      label: "Q3 EMEA",
      selection: { Region: ["EMEA"] },
      sheetId: "sheet-3",
    });

    await waitFor(() =>
      expect(canvas.getByRole("tab", { name: "Bookmarks", selected: true })).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(canvas.getByRole("option", { name: "EMEA, selected" })).toBeInTheDocument(),
    );
    await expect(canvas.queryByRole("option", { name: "APAC, selected" })).toBeNull();

    // #429: this switch WAS programmatic (a bookmark's own `sheetId`) — focus moves to the new
    // tab and the announcement is quoted exactly.
    const bookmarksTab = canvas.getByRole("tab", { name: "Bookmarks" });
    await expect(document.activeElement).toBe(bookmarksTab);
    await expect(status?.textContent).toBe("Showing sheet Bookmarks.");
  },
};
