import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import type { DashboardSpec } from "../core/spec";
import { DashboardProvider, DashboardSheet } from "../dashboard-sheet";
import { withBuiltInTiles } from "./built-in-tiles";

const TILES = withBuiltInTiles({});

const ALL_BUILT_INS: DashboardSpec = {
  version: 1,
  id: "all-built-ins",
  title: "Every built-in tile kind on one sheet",
  grid: { mode: "fit", columns: 24, rows: 16, gap: 8 },
  variables: [{ name: "region", type: "string", default: "EMEA", label: "Region" }],
  tiles: [
    {
      id: "heading",
      kind: "heading",
      layout: { x: 0, y: 0, w: 24, h: 1 },
      // level 2, not 1: every tile's own header is an h3 (`DashboardTileHeader`), so a
      // sheet-level h1 here would make axe's `heading-order` skip a level (#RM-075).
      content: { text: "EMEA overtook APAC in Q3", level: 2 },
    },
    {
      id: "kpi-revenue",
      kind: "metric",
      layout: { x: 0, y: 1, w: 6, h: 2 },
      content: {
        label: "Revenue",
        value: 1_200_000,
        delta: "+12.4%",
        deltaDirection: "up",
        series: [4, 6, 5, 8, 7, 9],
      },
    },
    {
      id: "kpi-margin",
      kind: "metric",
      layout: { x: 6, y: 1, w: 6, h: 2 },
      content: { label: "Margin", value: 0.31, delta: "+1.1pt", deltaDirection: "up" },
    },
    {
      id: "divider-1",
      kind: "divider",
      layout: { x: 12, y: 1, w: 1, h: 2 },
      content: { orientation: "vertical" },
    },
    {
      id: "note",
      kind: "text",
      layout: { x: 13, y: 1, w: 11, h: 2 },
      content: {
        body: "**EMEA** is now the _largest_ region. See the [regional report](https://example.com/report).",
      },
    },
    {
      id: "revenue-by-region",
      kind: "chart",
      layout: { x: 0, y: 3, w: 12, h: 5, minW: 4, minH: 2 },
      title: "EMEA is 41% of revenue",
      content: {
        type: "bar",
        data: [
          { region: "EMEA", revenue: 41 },
          { region: "APAC", revenue: 33 },
          { region: "AMER", revenue: 26 },
        ],
        x: "region",
        series: [{ key: "revenue", label: "Revenue" }],
      },
      consumes: { selection: true },
      emits: { selection: ["region"] },
    },
    {
      id: "revenue-trend",
      kind: "chart",
      layout: { x: 12, y: 3, w: 12, h: 5 },
      title: "Revenue by region, detail view",
      content: {
        type: "line",
        // Same `region` categories as `revenue-by-region` (not quarters) — RM-075's
        // acceptance bullet needs a SECOND chart whose marks share the selected field's
        // values, so clicking EMEA there flips this chart's matching mark too.
        data: [
          { region: "EMEA", revenue: 18 },
          { region: "APAC", revenue: 14 },
          { region: "AMER", revenue: 10 },
        ],
        x: "region",
        series: [{ key: "revenue", label: "Revenue" }],
      },
      consumes: { selection: ["region"] },
    },
    {
      id: "image",
      kind: "image",
      layout: { x: 0, y: 8, w: 6, h: 3 },
      content: { src: "", alt: "Regional map placeholder" },
    },
    {
      id: "region-variable",
      kind: "variable",
      layout: { x: 6, y: 8, w: 6, h: 1 },
      title: "Region",
      content: { name: "region", control: "select", options: ["EMEA", "APAC", "AMER"] },
    },
    {
      id: "clear-button",
      kind: "button",
      layout: { x: 6, y: 9, w: 6, h: 1 },
      content: { label: "Clear selections", action: { type: "clearSelections" } },
    },
    {
      id: "detail",
      kind: "container",
      layout: { x: 12, y: 8, w: 12, h: 4 },
      content: {
        kind: "tabs",
        tabs: [
          { id: "summary", label: "Summary", children: ["kpi-revenue"] },
          { id: "region", label: "Region", children: ["kpi-margin"] },
        ],
      },
    },
  ],
};

const meta = {
  title: "Dashboard/Tiles/Built-ins",
  component: DashboardSheet,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof DashboardSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

function renderSheet(spec: DashboardSpec) {
  return (
    <div data-testid="host" className="h-[900px] max-h-[95vh] w-full">
      <DashboardProvider spec={spec} tiles={TILES}>
        <DashboardSheet />
      </DashboardProvider>
    </div>
  );
}

export const AllBuiltInsOnOneSheet: Story = {
  name: "All built-ins on one sheet",
  render: () => renderSheet(ALL_BUILT_INS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sheet = await canvas.findByRole("region", { name: ALL_BUILT_INS.title });
    await waitFor(() => {
      expect(sheet.querySelectorAll("[data-tile-id]").length).toBe(ALL_BUILT_INS.tiles.length);
    });
    for (const kind of [
      "heading",
      "metric",
      "divider",
      "text",
      "chart",
      "image",
      "variable",
      "button",
      "container",
    ]) {
      expect(sheet.querySelector(`[data-tile-kind="${kind}"]`)).not.toBeNull();
    }
    // RM-075 acceptance: clicking a bar in `revenue-by-region` also flips the SECOND
    // chart's (`revenue-trend`) matching marks — both `consumes`/`emits` selection on the
    // shared "region" field, and (as of this fix) share the same region categories.
    const emeaBar = await canvas.findByRole("button", { name: "revenue, EMEA: 41" });
    emeaBar.focus();
    await userEvent.keyboard("{Enter}");
    const trendTile = sheet.querySelector('[data-tile-id="revenue-trend"]') as HTMLElement;
    await waitFor(() => {
      expect(trendTile.querySelectorAll('[data-selection="selected"]').length).toBeGreaterThan(0);
    });
    expect(trendTile.querySelectorAll('[data-selection="excluded"]').length).toBeGreaterThan(0);
  },
};

export const ChartKind: Story = {
  render: () =>
    renderSheet({
      ...ALL_BUILT_INS,
      id: "chart-only",
      title: "Revenue by region",
      tiles: [ALL_BUILT_INS.tiles.find((t) => t.id === "revenue-by-region")!],
    }),
};

/**
 * RM-075 Acceptance: "clicking a bar in the 'All built-ins' story selects that
 * category". `revenue-by-region` both `emits` and `consumes` selection on `region`
 * (RM-072/073's shared-filter pattern), so a click on its own EMEA bar is enough to
 * observe both halves of the click-to-select seam: the emit AND the resulting
 * `data-selection` repaint, without depending on a second chart sharing the same
 * category values.
 */
export const ChartClickSelects: Story = {
  name: "Chart tile: click a bar to select",
  render: () =>
    renderSheet({
      ...ALL_BUILT_INS,
      id: "chart-click",
      title: "Revenue by region",
      tiles: [ALL_BUILT_INS.tiles.find((t) => t.id === "revenue-by-region")!],
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("region", { name: "Revenue by region" });
    // The bar's real, focusable keyboard target — see charts.md "Drill-down": targets
    // live outside the <svg>. AutoChart's `<Bar>` here carries no `label`, so the shared
    // default name falls back to the series `dataKey` ("revenue"), not `series.label`
    // ("Revenue") — a pre-existing AutoChart quirk, not something this seam changes.
    const emeaBar = await canvas.findByRole("button", { name: "revenue, EMEA: 41" });
    // Keyboard activation, not `userEvent.click`: `ChartDatapointLayer`'s targets sit
    // under a `pointer-events: none` layer BY DESIGN (the SVG mark underneath owns the
    // pointer path — see the docblock in `chart-datapoint-layer.tsx`), so `userEvent`'s
    // own visibility check rejects a synthetic pointer click on the button. A real Enter
    // key on the focused target exercises the exact same `onDatapointClick` handler this
    // seam wires up (`source: "keyboard"` instead of `"pointer"`).
    emeaBar.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      const selected = canvasElement.querySelectorAll('[data-selection="selected"]');
      expect(selected.length).toBeGreaterThan(0);
    });
    const excluded = canvasElement.querySelectorAll('[data-selection="excluded"]');
    expect(excluded.length).toBeGreaterThan(0);
  },
};

export const MetricKind: Story = {
  render: () =>
    renderSheet({
      ...ALL_BUILT_INS,
      id: "metric-only",
      title: "Revenue",
      tiles: [ALL_BUILT_INS.tiles.find((t) => t.id === "kpi-revenue")!],
    }),
};

export const TextKind: Story = {
  render: () =>
    renderSheet({
      ...ALL_BUILT_INS,
      id: "text-only",
      title: "Region detail",
      tiles: [ALL_BUILT_INS.tiles.find((t) => t.id === "note")!],
    }),
};

export const HeadingKind: Story = {
  render: () =>
    renderSheet({
      ...ALL_BUILT_INS,
      id: "heading-only",
      title: "Heading",
      tiles: [ALL_BUILT_INS.tiles.find((t) => t.id === "heading")!],
    }),
};

export const DividerKind: Story = {
  render: () =>
    renderSheet({
      ...ALL_BUILT_INS,
      id: "divider-only",
      title: "Divider",
      grid: { mode: "fit", columns: 24, rows: 4, gap: 8 },
      tiles: [
        {
          ...ALL_BUILT_INS.tiles.find((t) => t.id === "divider-1")!,
          layout: { x: 0, y: 0, w: 4, h: 4 },
        },
      ],
    }),
};

export const ImageKind: Story = {
  render: () =>
    renderSheet({
      ...ALL_BUILT_INS,
      id: "image-only",
      title: "Image",
      tiles: [ALL_BUILT_INS.tiles.find((t) => t.id === "image")!],
    }),
};

export const ContainerKind: Story = {
  render: () =>
    renderSheet({
      ...ALL_BUILT_INS,
      id: "container-only",
      title: "Container",
      tiles: [
        ALL_BUILT_INS.tiles.find((t) => t.id === "kpi-revenue")!,
        ALL_BUILT_INS.tiles.find((t) => t.id === "kpi-margin")!,
        ALL_BUILT_INS.tiles.find((t) => t.id === "detail")!,
      ],
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("region", { name: "Container" });
    // `findAllByRole` (not `getAllByRole`): the tile body lazy-mounts once its
    // `IntersectionObserver` entry fires, so the tabs are not necessarily in the DOM the
    // instant the sheet's own region role is.
    const tabs = await canvas.findAllByRole("tab");
    expect(tabs.length).toBe(2);
    await userEvent.click(tabs[1]!);
  },
};

export const ButtonKind: Story = {
  render: () =>
    renderSheet({
      ...ALL_BUILT_INS,
      id: "button-only",
      title: "Button",
      tiles: [ALL_BUILT_INS.tiles.find((t) => t.id === "clear-button")!],
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole("button", { name: "Clear selections" });
    await userEvent.click(button);
  },
};

export const VariableKind: Story = {
  render: () =>
    renderSheet({
      ...ALL_BUILT_INS,
      id: "variable-only",
      title: "Region",
      tiles: [ALL_BUILT_INS.tiles.find((t) => t.id === "region-variable")!],
    }),
};
