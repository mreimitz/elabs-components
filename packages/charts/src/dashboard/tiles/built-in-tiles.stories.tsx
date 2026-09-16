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
      content: { text: "EMEA overtook APAC in Q3", level: 1 },
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
      title: "Revenue by quarter",
      content: {
        type: "line",
        data: [
          { region: "Q1", revenue: 10 },
          { region: "Q2", revenue: 14 },
          { region: "Q3", revenue: 18 },
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
    const tabs = canvas.getAllByRole("tab");
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
