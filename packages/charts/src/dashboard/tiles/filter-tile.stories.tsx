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

// ---------------------------------------------------------------------------
// Hierarchies — the filter pane as a tree (levels, parent-child), confirm sessions,
// the collapsed bar.
// ---------------------------------------------------------------------------

const GEO_ROWS = [
  { Continent: "AFRICA", Region: "NORTH_AFRICA", Country: "Egypt" },
  { Continent: "AFRICA", Region: "NORTH_AFRICA", Country: "Morocco" },
  { Continent: "AFRICA", Region: "SUB_SAHARAN", Country: "Kenya" },
  { Continent: "AFRICA", Region: "SUB_SAHARAN", Country: "Nigeria" },
  { Continent: "AMERICAS", Region: "CARIBBEAN", Country: "Jamaica" },
  { Continent: "AMERICAS", Region: "CARIBBEAN", Country: "Cuba" },
  { Continent: "AMERICAS", Region: "MEXICO", Country: "Mexico" },
  { Continent: "AMERICAS", Region: "NORTH_AMERICA", Country: "United States" },
  { Continent: "AMERICAS", Region: "SOUTH_AMERICA", Country: "Brazil" },
  { Continent: "AMERICAS", Region: "SOUTH_AMERICA", Country: "Chile" },
  { Continent: "AMERICAS", Region: "SOUTH_AMERICA", Country: "Argentina" },
  { Continent: "ASIA", Region: "DEVELOPED_ASIA", Country: "Japan" },
  { Continent: "ASIA", Region: "DEVELOPED_ASIA", Country: "Korea" },
  { Continent: "ASIA", Region: "GREATER_CHINA", Country: "China" },
  { Continent: "ASIA", Region: "GREATER_CHINA", Country: "Taiwan" },
  { Continent: "ASIA", Region: "OCEANIA", Country: "Australia" },
];

const GEO_FIELDS = ["Continent", "Region", "Country"];

function hierarchySpec(
  overrides: Partial<FilterTileContent> = {},
  layout = { x: 0, y: 0, w: 4, h: 6 },
): DashboardSpec {
  return {
    version: 1,
    id: "filter-tile-hierarchy",
    grid: { mode: "fit", columns: 12, rows: 6, gap: 8 },
    tiles: [
      {
        id: "geo",
        kind: "filter",
        layout,
        content: {
          field: "Continent",
          label: "Region",
          levels: GEO_FIELDS.map((field) => ({ field })),
          rows: GEO_ROWS,
          search: true,
          showCounts: true,
          expandLevel: 1,
          ...overrides,
        },
      },
      {
        id: "country",
        kind: "filter",
        title: "Country",
        layout: { x: 4, y: 0, w: 4, h: 6 },
        content: {
          field: "Country",
          values: [...new Set(GEO_ROWS.map((row) => row.Country))].map((value) => ({ value })),
        },
      },
    ],
  };
}

function renderHierarchy(spec: DashboardSpec, height = 360) {
  const driver = createLocalSelectionDriver();
  driver.register("rows", GEO_ROWS, GEO_FIELDS);
  return (
    <div style={{ height }}>
      <DashboardProvider spec={spec} driver={driver} tiles={[filterTileKind]}>
        <DashboardSheet renderAll />
      </DashboardProvider>
    </div>
  );
}

/**
 * Three levels (Continent → Region → Country) from one row set: the tree opens to level 1,
 * parents carry counts, clicking a value selects it in ITS field (a Region click filters the
 * Country list beside it), the chevron alone expands.
 */
export const Hierarchy: Story = {
  render: () => renderHierarchy(hierarchySpec()),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tree = await canvas.findByRole("tree");
    // Level 1 open: continents visible, regions too, countries not yet.
    await expect(within(tree).getByText("AMERICAS")).toBeInTheDocument();
    await expect(within(tree).getByText("SOUTH_AMERICA")).toBeInTheDocument();
    await expect(within(tree).queryByText("Brazil")).toBeNull();
    // Selecting a region excludes countries outside it in the flat tile beside the tree.
    await userEvent.click(within(tree).getByText("SOUTH_AMERICA"));
    await waitFor(() =>
      expect(canvas.getByRole("option", { name: "Japan, excluded" })).toBeInTheDocument(),
    );
    await expect(canvas.getByRole("option", { name: "Brazil" })).toBeInTheDocument();
    // The chevron (the row's first child, `aria-hidden`) expands without changing the selection.
    const row = within(tree).getByText("SOUTH_AMERICA").closest('[role="treeitem"]')!;
    await userEvent.click(row.firstElementChild as HTMLElement);
    await expect(await within(tree).findByText("Brazil")).toBeInTheDocument();
    await expect(canvas.getByRole("option", { name: "Japan, excluded" })).toBeInTheDocument();
  },
};

/** A self-referential table: parent id → child id, with the display name in a third field. */
export const ParentChild: Story = {
  render: () =>
    renderHierarchy(
      hierarchySpec({
        field: "Id",
        label: "Organisation",
        levels: undefined,
        parentChild: { parentField: "ManagerId", childField: "Id", labelField: "Name" },
        rows: [
          { Id: "1", ManagerId: null, Name: "Alice (CEO)" },
          { Id: "2", ManagerId: "1", Name: "Bob (VP Engineering)" },
          { Id: "3", ManagerId: "2", Name: "Charlie (Lead Dev)" },
          { Id: "4", ManagerId: "1", Name: "Diana (VP Sales)" },
          { Id: "5", ManagerId: "4", Name: "Erin (AE)" },
        ],
        expandLevel: -1,
      }),
    ),
  play: async ({ canvasElement }) => {
    const tree = await within(canvasElement).findByRole("tree");
    await expect(within(tree).getByText("Charlie (Lead Dev)")).toBeInTheDocument();
  },
};

/** Leaf-only: parents expand on click, only countries select; select-with-children off. */
export const LeafOnly: Story = {
  render: () => renderHierarchy(hierarchySpec({ leafOnly: true, expandLevel: 0 })),
  play: async ({ canvasElement }) => {
    const tree = await within(canvasElement).findByRole("tree");
    await userEvent.click(within(tree).getByText("ASIA"));
    await expect(await within(tree).findByText("OCEANIA")).toBeInTheDocument();
  },
};

/** Select with children: a continent click selects every region and country under it. */
export const SelectWithChildren: Story = {
  render: () => renderHierarchy(hierarchySpec({ selectWithChildren: true, expandLevel: 2 })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tree = await canvas.findByRole("tree");
    await userEvent.click(within(tree).getByText("ASIA"));
    await waitFor(() =>
      expect(canvas.getByRole("option", { name: "Japan, selected" })).toBeInTheDocument(),
    );
  },
};

/** Confirm sessions: clicks collect; nothing reaches the driver until the check mark. */
export const ConfirmSession: Story = {
  render: () => renderHierarchy(hierarchySpec({ confirm: true })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tree = await canvas.findByRole("tree");
    await userEvent.click(within(tree).getByText("AFRICA"));
    // Pending: the flat tile beside is untouched…
    await expect(canvas.getByRole("option", { name: "Japan" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Confirm selection" }));
    // …until confirmed.
    await waitFor(() =>
      expect(canvas.getByRole("option", { name: "Japan, excluded" })).toBeInTheDocument(),
    );
  },
};

/** One row high: the tile is a bar; clicking opens the full tree in a popover. */
export const CollapsedBar: Story = {
  render: () => renderHierarchy(hierarchySpec({}, { x: 0, y: 0, w: 4, h: 1 }), 480),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bar = await canvas.findByRole("button", { name: "Open Region" });
    await userEvent.click(bar);
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole("tree")).toBeInTheDocument();
  },
};
