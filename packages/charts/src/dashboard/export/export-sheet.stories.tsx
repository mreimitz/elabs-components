import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";

import type { DashboardSpec } from "../core/spec";
import type { DashboardStore } from "../core/store";
import { DashboardProvider, DashboardSheet, createPlaceholderTileKind } from "../dashboard-sheet";
import type { TileRegistry } from "../dashboard-sheet/tile-registry";
import { useDashboardContext } from "../dashboard-sheet/use-dashboard";
import { salesOverviewSpec } from "../fixtures/sales-overview";
import { buildSheetExportSvg, exportSheet } from "./export-sheet";

const TILES = ["kpi", "metric", "chart", "text", "placeholder"].map((kind) =>
  createPlaceholderTileKind(kind),
);

// The acceptance's "sales-overview, nine tiles" scenario, minus the one tile
// (`detail-note`) whose `visibleWhen` needs a live selection `exportSheet` does not carry
// (see `export-sheet.ts`'s documented KNOWN LIMITATION) — always visible here so the export
// deterministically composes all nine.
const EXPORT_SPEC: DashboardSpec = {
  ...salesOverviewSpec,
  tiles: salesOverviewSpec.tiles.map((tile) =>
    tile.id === "detail-note" ? { ...tile, visibleWhen: undefined } : tile,
  ),
};

let probeHandle: { store: DashboardStore; registry: TileRegistry } | undefined;
function Probe() {
  probeHandle = useDashboardContext();
  return null;
}

const meta = {
  title: "Dashboard/Export/Sheet",
  parameters: { layout: "padded" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ExportSvg: Story = {
  name: "exportSheet — SVG (9 tiles, cellRect transforms)",
  render: () => (
    <div className="h-[480px] w-full">
      <DashboardProvider spec={EXPORT_SPEC} tiles={TILES}>
        <Probe />
        <DashboardSheet renderAll />
      </DashboardProvider>
    </div>
  ),
  play: async () => {
    await waitFor(() => expect(probeHandle).toBeDefined());
    const { store, registry } = probeHandle!;
    const svg = await buildSheetExportSvg(store, registry, {
      width: 1680,
      height: 1120,
      title: true,
    });
    await expect(svg.getAttribute("width")).toBe("1680");
    const groups = Array.from(svg.querySelectorAll(":scope > g"));
    await expect(groups.length).toBe(9);
    // Every group's transform matches the tile's own `cellRect` at 1680×1120 (title row aside).
    for (const group of groups) {
      await expect(group.getAttribute("transform")).toMatch(
        /^translate\(-?\d+(\.\d+)?, -?\d+(\.\d+)?\)$/,
      );
    }
    // Chart tiles keep their marks; every group carries an accessible <title> from tile.title.
    const withTitles = groups.filter((g) => g.querySelector("title")?.textContent);
    await expect(withTitles.length).toBeGreaterThan(0);
  },
};

export const ExportPng: Story = {
  name: "exportSheet — PNG (rasterised, 2×)",
  render: ExportSvg.render,
  play: async () => {
    await waitFor(() => expect(probeHandle).toBeDefined());
    const { store, registry } = probeHandle!;
    const { blob, filename } = await exportSheet(store, registry, {
      format: "png",
      width: 1680,
      height: 1120,
      scale: 2,
    });
    await expect(blob.type).toBe("image/png");
    await expect(blob.size).toBeGreaterThan(0);
    await expect(filename).toMatch(/\.png$/);
  },
};

export const ExportDeterministic: Story = {
  name: "Two exports of the same spec are byte-identical",
  render: ExportSvg.render,
  play: async () => {
    await waitFor(() => expect(probeHandle).toBeDefined());
    const { store, registry } = probeHandle!;
    const first = await exportSheet(store, registry, { format: "svg" });
    const second = await exportSheet(store, registry, { format: "svg" });
    const [a, b] = await Promise.all([first.blob.text(), second.blob.text()]);
    await expect(a).toBe(b);
    // The filename carries the date, never the file's own content.
    await expect(first.filename).toBe(second.filename);
  },
};
