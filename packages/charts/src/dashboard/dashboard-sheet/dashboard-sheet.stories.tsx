import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { cellRect } from "../core/layout";
import type { DashboardSpec, TileSpec } from "../core/spec";
import { opsFlowSpec } from "../fixtures/ops-flow";
import { salesOverviewSpec } from "../fixtures/sales-overview";
import { DashboardProvider, DashboardSheet, createPlaceholderTileKind } from "./index";

const TILES = ["kpi", "chart", "text", "placeholder"].map((kind) =>
  createPlaceholderTileKind(kind),
);
// RM-077's typed fixtures (`../fixtures/*`) — the same RM-070 golden layouts, but with real
// 24-row seeded datasets on every `chart` tile instead of the raw JSON's 2-point placeholder
// arrays (`withRealRows`, `../fixtures/apply-rows.ts`).
const SALES: DashboardSpec = salesOverviewSpec;
const OPS: DashboardSpec = opsFlowSpec;

const LAZY: DashboardSpec = {
  version: 1,
  id: "lazy-40",
  title: "Forty tiles mount as they scroll into view",
  grid: { mode: "flow", columns: 24, rowHeight: 30, gap: 8 },
  tiles: Array.from(
    { length: 40 },
    (_, i): TileSpec => ({
      id: `tile-${i + 1}`,
      kind: "placeholder",
      title: `Tile ${i + 1}`,
      layout: { x: (i % 4) * 6, y: Math.floor(i / 4) * 6, w: 6, h: 6 },
      content: {},
    }),
  ),
};

const meta = {
  title: "Dashboard/Sheet",
  component: DashboardSheet,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof DashboardSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Fit24x12: Story = {
  name: "Fit 24×12",
  render: (args) => (
    <div data-testid="host" className="h-[480px] max-h-[80vh] w-full">
      <DashboardProvider spec={SALES} tiles={TILES}>
        <DashboardSheet {...args} />
      </DashboardProvider>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const host = within(canvasElement).getByTestId("host");
    const sheet = await within(canvasElement).findByRole("region", { name: SALES.title });
    await waitFor(() => expect(sheet.querySelectorAll("[data-tile-id]").length).toBe(8));
    // A definite host height is divided into rows: the sheet fills it and nothing scrolls.
    await expect(sheet).toHaveAttribute("data-fill", "host");
    const box = sheet.getBoundingClientRect();
    await expect(Math.abs(box.height - host.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
    await expect(host.scrollHeight).toBeLessThanOrEqual(host.clientHeight + 1);
    const size = { width: box.width, height: box.height };
    const visibleTiles = SALES.tiles.filter((t) => !t.visibleWhen);
    for (const tile of visibleTiles) {
      const el = sheet.querySelector(`[data-tile-id="${tile.id}"]`) as HTMLElement;
      const want = cellRect(tile.layout, SALES.grid, size);
      await waitFor(() => {
        const got = el.getBoundingClientRect();
        expect(Math.abs(got.left - box.left - want.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(got.top - box.top - want.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(got.width - want.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(got.height - want.height)).toBeLessThanOrEqual(1);
      });
    }
    // The lowest tile reaches the sheet's bottom edge when the layout spans every row.
    const rows = SALES.grid.rows ?? 12;
    if (visibleTiles.some((t) => t.layout.y + t.layout.h === rows)) {
      const bottom = Math.max(
        ...Array.from(sheet.querySelectorAll("[data-tile-id]")).map(
          (el) => el.getBoundingClientRect().bottom,
        ),
      );
      await expect(Math.abs(bottom - box.bottom)).toBeLessThanOrEqual(1);
    }

    const tiles = Array.from(sheet.querySelectorAll<HTMLElement>("[data-tile-id]"));
    tiles[0]!.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(tiles[1]).toHaveFocus();
    // Full screen through the kebab menu: the inline expand button hides at xs/sm density,
    // and the test browser's width decides the density.
    const owner = tiles[1]!;
    within(owner).getByRole("button", { name: "More actions" }).focus();
    await userEvent.keyboard("{Enter}");
    const item = await within(document.body).findByRole("menuitem", { name: "Full screen" });
    await waitFor(() => expect(item).toHaveFocus());
    await userEvent.keyboard("{Enter}");
    await within(document.body).findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(owner).toHaveFocus());
  },
};

export const Flow24Columns: Story = {
  name: "Flow 24 columns",
  render: (args) => (
    <DashboardProvider spec={OPS} tiles={TILES}>
      <DashboardSheet {...args} />
    </DashboardProvider>
  ),
};

export const LazyRender: Story = {
  name: "Lazy render (40 tiles)",
  render: (args) => (
    <div data-testid="scroller" className="h-[600px] w-full overflow-auto">
      <DashboardProvider spec={LAZY} tiles={TILES}>
        <DashboardSheet {...args} />
      </DashboardProvider>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const scroller = within(canvasElement).getByTestId("scroller");
    await waitFor(() => expect(scroller.querySelectorAll("[data-tile-id]").length).toBe(40));
    await waitFor(() =>
      expect(scroller.querySelectorAll("[data-tile-body-mounted]").length).toBeGreaterThan(0),
    );
    const root = scroller.getBoundingClientRect();
    const band = { top: root.top - root.height, bottom: root.bottom + root.height };
    const inBand = Array.from(scroller.querySelectorAll("[data-tile-id]")).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom >= band.top && r.top <= band.bottom;
    }).length;
    const mounted = scroller.querySelectorAll("[data-tile-body-mounted]").length;
    await expect(mounted).toBeLessThanOrEqual(inBand);
    await expect(mounted).toBeLessThan(40);
  },
};

export const RenderAll: Story = {
  name: "Lazy render, renderAll",
  args: { renderAll: true },
  render: LazyRender.render,
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelectorAll("[data-tile-body-mounted]").length).toBe(40),
    );
  },
};

export const ContainersTabs: Story = {
  name: "Containers (tabs)",
  render: Flow24Columns.render,
  play: async ({ canvasElement }) => {
    const tab = await within(canvasElement).findByRole("tab", { name: "Throughput" });
    await userEvent.click(tab);
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-tile-id="throughput"]')).not.toBeNull(),
    );
  },
};

export const NarrowContainer: Story = {
  name: "Narrow container",
  render: (args) => (
    <div className="w-full max-w-sm">
      <DashboardProvider spec={SALES} tiles={TILES}>
        <DashboardSheet {...args} />
      </DashboardProvider>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // No definite host height: fit falls back to square cells.
    await waitFor(() =>
      expect(canvasElement.querySelector("[data-slot=dashboard-sheet]")).toHaveAttribute(
        "data-fill",
        "square",
      ),
    );
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-tile-id="kpi-revenue"]')).toHaveAttribute(
        "data-density",
        "xs",
      ),
    );
  },
};
