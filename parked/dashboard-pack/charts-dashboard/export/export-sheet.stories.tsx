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
    // The whole composed picture also gets its own accessible name (WCAG 1.1.1): a root
    // <title> as the first child, named via aria-labelledby, role="img" on the root itself.
    await expect(svg.getAttribute("role")).toBe("img");
    const rootTitle = svg.firstElementChild;
    await expect(rootTitle?.tagName).toBe("title");
    await expect(rootTitle?.textContent).toBe(EXPORT_SPEC.title);
    await expect(svg.getAttribute("aria-labelledby")).toBe(rootTitle?.getAttribute("id"));
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
    // responsive layout — RM-084 follow-up 2 (F2): decode the actual raster, not just the blob
    // envelope — `scale: 2` at `width: 1680` must produce a 3360-wide PNG. Height is the
    // composed SVG's OWN `height` (the requested 1120 plus the default title row) × scale, read
    // from the same-options SVG rather than hardcoded, since the title row's exact px is an
    // internal `composeSvg` detail this play should not need to know.
    const svg = await buildSheetExportSvg(store, registry, {
      width: 1680,
      height: 1120,
      scale: 2,
    });
    const expectedHeight = Number.parseFloat(svg.getAttribute("height") ?? "0") * 2;
    const bitmap = await createImageBitmap(blob);
    await expect(bitmap.width).toBe(3360);
    await expect(bitmap.height).toBe(expectedHeight);
    bitmap.close();
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

/** The first REAL (opaque, non-`currentColor`) resolved `fill`/`stroke` in an export SVG. */
function firstResolvedColor(svg: SVGSVGElement): string {
  const isRealColor = (value: string | null) =>
    value !== null && !/^(none|transparent|currentcolor)$/i.test(value);
  for (const el of svg.querySelectorAll("[fill], [stroke]")) {
    const fill = el.getAttribute("fill");
    if (isRealColor(fill)) return fill as string;
    const stroke = el.getAttribute("stroke");
    if (isRealColor(stroke)) return stroke as string;
  }
  return "";
}

// responsive layout — RM-084 follow-up 2 (F3): `buildExportSvg`/`composeSvg` bake in resolved
// (computed) styles at build time (module doc above) — off-screen tiles inherit whatever
// `data-theme` is on `document.documentElement` (`ThemeProvider`'s own mechanism, RM-034's
// `resolveThemeIsDark` pattern), so flipping it between calls should bake in different colours.
export const ExportThemeDiffers: Story = {
  name: "exportSheet — light vs dark bake in different resolved colours",
  render: ExportSvg.render,
  play: async () => {
    await waitFor(() => expect(probeHandle).toBeDefined());
    const { store, registry } = probeHandle!;
    const originalTheme = document.documentElement.getAttribute("data-theme");
    try {
      document.documentElement.setAttribute("data-theme", "light");
      const lightSvg = await buildSheetExportSvg(store, registry, { width: 1680, height: 1120 });
      const light = firstResolvedColor(lightSvg);

      document.documentElement.setAttribute("data-theme", "dark");
      const darkSvg = await buildSheetExportSvg(store, registry, { width: 1680, height: 1120 });
      const dark = firstResolvedColor(darkSvg);

      await expect(light).not.toBe("");
      await expect(dark).not.toBe("");
      await expect(light).not.toBe(dark);
    } finally {
      if (originalTheme === null) document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", originalTheme);
    }
  },
};
