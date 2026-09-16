import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { createLocalSelectionDriver } from "../core/local-selection-driver";
import type { DashboardSpec } from "../core/spec";
import { DashboardProvider, DashboardSheet } from "../dashboard-sheet";
import { createFilterTileKind, filterTileKind, type FilterTileContent } from "./filter-tile";

const ROWS = [
  { Region: "EMEA", Product: "Widget" },
  { Region: "EMEA", Product: "Widget" },
  { Region: "EMEA", Product: "Gadget" },
  { Region: "APAC", Product: "Gadget" },
  { Region: "APAC", Product: "Gizmo" },
];

function productValues(): FilterTileContent["values"] {
  const counts = new Map<string, number>();
  for (const row of ROWS) counts.set(row.Product, (counts.get(row.Product) ?? 0) + 1);
  return [...counts.entries()].map(([value, count]) => ({ value, count }));
}

function regionValues(): FilterTileContent["values"] {
  const counts = new Map<string, number>();
  for (const row of ROWS) counts.set(row.Region, (counts.get(row.Region) ?? 0) + 1);
  return [...counts.entries()].map(([value, count]) => ({ value, count }));
}

function twoFieldSpec(overrides: Partial<FilterTileContent> = {}): DashboardSpec {
  return {
    version: 1,
    id: "filter-tile-demo",
    grid: { mode: "fit", columns: 12, rows: 6, gap: 8 },
    tiles: [
      {
        id: "region",
        kind: "filter",
        title: "Region",
        layout: { x: 0, y: 0, w: 4, h: 6 },
        content: {
          field: "Region",
          values: regionValues(),
          search: true,
          showCounts: true,
          ...overrides,
        },
      },
      {
        id: "product",
        kind: "filter",
        title: "Product",
        layout: { x: 4, y: 0, w: 4, h: 6 },
        content: { field: "Product", values: productValues(), showCounts: true },
      },
    ],
  };
}

const meta = {
  title: "Dashboard/Tiles/Filter",
  component: DashboardSheet,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof DashboardSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Two filter tiles sharing a dataset: selecting a Region value excludes Products absent from it. */
export const Default: Story = {
  render: () => {
    const driver = createLocalSelectionDriver();
    driver.register("rows", ROWS, ["Region", "Product"]);
    return (
      <div className="h-[360px]">
        <DashboardProvider spec={twoFieldSpec()} driver={driver} tiles={[filterTileKind]}>
          <DashboardSheet renderAll />
        </DashboardProvider>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const emea = await canvas.findByRole("option", { name: /EMEA/ });
    await userEvent.click(emea);
    // Gizmo only ever appears on APAC rows, so it excludes once EMEA is selected.
    await waitFor(async () => {
      const gizmo = await canvas.findByRole("option", { name: /Gizmo, excluded/ });
      await expect(gizmo).toHaveAttribute("data-selection", "excluded");
    });
    const widget = await canvas.findByRole("option", { name: /Widget/ });
    await expect(widget).toHaveAttribute("data-selection", "associated");
  },
};

/** Single mode: picking a second value replaces the first instead of adding to it. */
export const SingleMode: Story = {
  render: () => {
    const driver = createLocalSelectionDriver();
    driver.register("rows", ROWS, ["Region"]);
    const spec: DashboardSpec = {
      version: 1,
      id: "filter-tile-single",
      grid: { mode: "fit", columns: 6, rows: 6, gap: 8 },
      tiles: [
        {
          id: "region",
          kind: "filter",
          title: "Region",
          layout: { x: 0, y: 0, w: 6, h: 6 },
          content: { field: "Region", values: regionValues(), mode: "single" },
        },
      ],
    };
    return (
      <div className="h-[280px] w-64">
        <DashboardProvider spec={spec} driver={driver} tiles={[filterTileKind]}>
          <DashboardSheet renderAll />
        </DashboardProvider>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("option", { name: /EMEA/ }));
    // Picking APAC replaces EMEA (single mode) — EMEA, the same field's other value,
    // reads "excluded" (no row has both), not "associated".
    await userEvent.click(await canvas.findByRole("option", { name: /APAC/ }));
    await waitFor(async () => {
      const emea = await canvas.findByRole("option", { name: /EMEA, excluded/ });
      await expect(emea).toHaveAttribute("data-selection", "excluded");
      const apac = await canvas.findByRole("option", { name: /APAC, selected/ });
      await expect(apac).toHaveAttribute("data-selection", "selected");
    });
  },
};

/** A locked field: the checkbox rows stay read-only and "Clear" is disabled. */
export const Locked: Story = {
  render: () => {
    const driver = createLocalSelectionDriver();
    driver.register("rows", ROWS, ["Region"]);
    driver.select("Region", ["EMEA"], { replace: true });
    driver.lock("Region", true);
    const spec: DashboardSpec = {
      version: 1,
      id: "filter-tile-locked",
      grid: { mode: "fit", columns: 6, rows: 6, gap: 8 },
      tiles: [
        {
          id: "region",
          kind: "filter",
          title: "Region",
          layout: { x: 0, y: 0, w: 6, h: 6 },
          content: { field: "Region", values: regionValues() },
        },
      ],
    };
    return (
      <div className="h-[280px] w-64">
        <DashboardProvider spec={spec} driver={driver} tiles={[filterTileKind]}>
          <DashboardSheet renderAll />
        </DashboardProvider>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A locked field's rows are genuinely inert (`pointer-events: none`, not just a no-op
    // handler) — assert the disabled state rather than attempting an impossible click.
    const apac = await canvas.findByRole("option", { name: /APAC/ });
    await expect(apac).toHaveAttribute("aria-disabled", "true");
    const emea = await canvas.findByRole("option", { name: /EMEA, selected/ });
    await expect(emea).toBeInTheDocument();
  },
};

/** Edit mode (`interactions.select` off): clicking a row does not change the selection. */
export const EditModeInert: Story = {
  name: "Edit mode (inert)",
  render: () => {
    const driver = createLocalSelectionDriver();
    driver.register("rows", ROWS, ["Region"]);
    const spec: DashboardSpec = {
      version: 1,
      id: "filter-tile-edit",
      grid: { mode: "fit", columns: 6, rows: 6, gap: 8 },
      view: { mode: "edit" },
      tiles: [
        {
          id: "region",
          kind: "filter",
          title: "Region",
          layout: { x: 0, y: 0, w: 6, h: 6 },
          content: { field: "Region", values: regionValues() },
        },
      ],
    };
    return (
      <div className="h-[280px] w-64">
        <DashboardProvider spec={spec} driver={driver} tiles={[filterTileKind]}>
          <DashboardSheet renderAll />
        </DashboardProvider>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Edit mode's rows are genuinely inert (`pointer-events: none`, not just a no-op
    // handler) — assert the disabled state rather than attempting an impossible click.
    const emea = await canvas.findByRole("option", { name: /EMEA/ });
    await expect(emea).toHaveAttribute("aria-disabled", "true");
    await expect(emea).toHaveAttribute("data-selection", "associated");
  },
};

/** A localised `filter` kind, built with `createFilterTileKind`. */
export const CustomLabels: Story = {
  render: () => {
    const kind = createFilterTileKind("filter", {
      search: (label) => `Suche ${label}…`,
      empty: "Keine Treffer.",
      clear: "Zurücksetzen",
      lock: (label) => `${label} sperren`,
      unlock: (label) => `${label} entsperren`,
      moreActions: (label) => `${label}-Aktionen`,
      locked: "Gesperrt",
      valueState: (label, state) => (state === "selected" ? `${label}, ausgewählt` : label),
    });
    const driver = createLocalSelectionDriver();
    driver.register("rows", ROWS, ["Region"]);
    const spec: DashboardSpec = {
      version: 1,
      id: "filter-tile-labels",
      grid: { mode: "fit", columns: 6, rows: 6, gap: 8 },
      tiles: [
        {
          id: "region",
          kind: "filter",
          title: "Region",
          layout: { x: 0, y: 0, w: 6, h: 6 },
          content: { field: "Region", values: regionValues(), search: true },
        },
      ],
    };
    return (
      <div className="h-[280px] w-64">
        <DashboardProvider spec={spec} driver={driver} tiles={[kind]}>
          <DashboardSheet renderAll />
        </DashboardProvider>
      </div>
    );
  },
};
