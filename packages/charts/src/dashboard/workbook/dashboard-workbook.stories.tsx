import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import type { DashboardSpec, WorkbookSpec } from "../core/spec";
import { builtInTiles } from "../tiles";
import { DashboardWorkbook } from "./dashboard-workbook";

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
    id: "sheet-3",
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

/** Three sheets; "Archived" (`showCondition: "false"`) never reaches the nav. Clicking a bar in
 * "Overview"'s chart drills into "Detail" and carries the selection there. */
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

    // A bar's datapoint target (the chart's keyboard path; the layer itself is
    // `pointer-events: none` — same activation pattern as dashboard-interactions-editor.stories.tsx).
    let bar: HTMLElement | null = null;
    await waitFor(() => {
      bar = canvasElement.querySelector<HTMLElement>(
        '[data-tile-id="region-chart"] [data-slot="chart-datapoint-layer-target"]',
      );
      expect(bar).not.toBeNull();
    });
    bar!.focus();
    await userEvent.keyboard("{Enter}");

    // Drilled to "Detail", carrying the clicked region into its filter.
    await waitFor(async () => {
      await expect(canvas.getByRole("tab", { name: "Detail", selected: true })).toBeInTheDocument();
    });
    await waitFor(async () => {
      await expect(
        canvas.getByRole("option", { name: /EMEA, selected|APAC, selected/ }),
      ).toBeInTheDocument();
    });
  },
};
