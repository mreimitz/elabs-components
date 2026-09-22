import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Bar } from "../../charts/bar";
import { BarChart } from "../../charts/bar-chart";
import { BarXAxis } from "../../charts/bar-x-axis";
import { Grid } from "../../charts/grid";
import { createLocalSelectionDriver } from "../core/local-selection-driver";
import type { SelectionSnapshot } from "../core/selection";
import type { DashboardSpec, VariableValue } from "../core/spec";
import { DashboardProvider, DashboardSheet } from "../dashboard-sheet";
import type { DashboardTileKind, DashboardTileProps } from "../dashboard-sheet/tile-registry";
import { filterTileKind, type FilterTileContent } from "../tiles/filter-tile";
import { DashboardSelectionBar } from "./dashboard-selection-bar";

/**
 * The rows the two filter tiles and the two `region-bar`/`product-bar` demo tiles share
 * (registered once on one `SelectionDriver`, so a selection on one field narrows the other —
 * analysis §2.0's cross-field association, not a per-tile mock).
 */
const ROWS = [
  { Region: "EMEA", Product: "Widget" },
  { Region: "EMEA", Product: "Widget" },
  { Region: "EMEA", Product: "Gadget" },
  { Region: "APAC", Product: "Gadget" },
  { Region: "APAC", Product: "Gadget" },
  { Region: "APAC", Product: "Gizmo" },
];

function countsBy(key: "Region" | "Product"): { key: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const row of ROWS) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return [...counts.entries()].map(([k, value]) => ({ key: k, value }));
}

function fieldValues(key: "Region" | "Product"): FilterTileContent["values"] {
  return countsBy(key).map(({ key: value, value: count }) => ({ value, count }));
}

/** A minimal demo tile: one bar per distinct value of `content.field`, tri-state painted. */
function createBarTileKind(kind: string, field: "Region" | "Product"): DashboardTileKind {
  function BarTile({ selection }: DashboardTileProps) {
    return (
      <div className="size-full min-h-0">
        <BarChart
          data={countsBy(field)}
          xDataKey="key"
          animationDuration={0}
          selectionStates={(category) => selection.states(field, category)}
        >
          <Grid horizontal />
          <Bar dataKey="value" fill="var(--chart-1)" />
          <BarXAxis />
        </BarChart>
      </div>
    );
  }
  return {
    kind,
    label: field, // i18n-exempt: story-only demo tile label
    component: BarTile,
    defaultSize: { w: 6, h: 6 },
    minSize: { w: 2, h: 2 },
    capabilities: { consumesSelection: true },
    configForm: { formName: `${kind}-tile`, fields: [] },
    defaultContent: {},
  };
}

const regionBarKind = createBarTileKind("region-bar", "Region");
const productBarKind = createBarTileKind("product-bar", "Product");

function buildSpec(): DashboardSpec {
  return {
    version: 1,
    id: "selection-bar-demo",
    title: "Region and product mix",
    grid: { mode: "fit", columns: 24, rows: 8, gap: 8 },
    bookmarks: [{ id: "emea-focus", label: "EMEA focus", selection: { Region: ["EMEA"] } }],
    tiles: [
      {
        id: "region-filter",
        kind: "filter",
        title: "Region",
        layout: { x: 0, y: 0, w: 6, h: 8 },
        content: { field: "Region", values: fieldValues("Region"), showCounts: true },
      },
      {
        id: "product-filter",
        kind: "filter",
        title: "Product",
        layout: { x: 6, y: 0, w: 6, h: 8 },
        content: { field: "Product", values: fieldValues("Product"), showCounts: true },
      },
      {
        id: "region-chart",
        kind: "region-bar",
        title: "Rows by region",
        layout: { x: 12, y: 0, w: 6, h: 8 },
        content: {},
      },
      {
        id: "product-chart",
        kind: "product-bar",
        title: "Rows by product",
        layout: { x: 18, y: 0, w: 6, h: 8 },
        content: {},
      },
    ],
  };
}

const meta = {
  title: "Dashboard/Selection bar",
  component: DashboardSelectionBar,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof DashboardSelectionBar>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Two filter tiles and two chart tiles sharing one dataset: selecting EMEA dims the APAC
 * bar and excludes Gizmo (an APAC-only product) from the Product filter, sorted last.
 */
export const WithFilterTiles: Story = {
  name: "With filter tiles",
  render: () => {
    const driver = createLocalSelectionDriver();
    driver.register("rows", ROWS, ["Region", "Product"]);
    return (
      <div className="flex h-[520px] flex-col gap-3">
        <DashboardProvider
          spec={buildSpec()}
          driver={driver}
          tiles={[filterTileKind, regionBarKind, productBarKind]}
        >
          <DashboardSelectionBar driver={driver} />
          <div className="min-h-0 flex-1">
            <DashboardSheet />
          </div>
        </DashboardProvider>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bar = await canvas.findByRole("toolbar", { name: "Selections" });
    const back = within(bar).getByRole("button", { name: "Step back" });
    const forward = within(bar).getByRole("button", { name: "Step forward" });
    await expect(back).toBeDisabled();
    await expect(forward).toBeDisabled();

    const emea = await canvas.findByRole("option", { name: /EMEA/ });
    await userEvent.click(emea);

    // A chip appears, and the APAC bar (and only the APAC bar) excludes.
    await waitFor(async () => {
      await expect(within(bar).getByText("Region")).toBeInTheDocument();
    });
    await waitFor(async () => {
      const apacBar = canvasElement.querySelector('[data-selection="excluded"]');
      await expect(apacBar).not.toBeNull();
    });
    // Gizmo only occurs on APAC rows, so it excludes and sorts after the associated rows.
    await waitFor(async () => {
      const gizmo = await canvas.findByRole("option", { name: /Gizmo, excluded/ });
      await expect(gizmo).toHaveAttribute("data-selection", "excluded");
    });
    await expect(back).not.toBeDisabled();

    // Step back undoes the selection; the chip disappears.
    await userEvent.click(back);
    await waitFor(() => expect(within(bar).queryByText("Region")).not.toBeInTheDocument());
    await expect(forward).not.toBeDisabled();
  },
};

/** Clearing one field's chip restores `associated` everywhere without touching other fields. */
export const ClearField: Story = {
  render: WithFilterTiles.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("option", { name: /EMEA/ }));
    const bar = await canvas.findByRole("toolbar", { name: "Selections" });
    const clearRegion = within(bar).getByRole("button", { name: "Clear Region" });
    await userEvent.click(clearRegion);
    await waitFor(() => expect(within(bar).queryByText("Region")).not.toBeInTheDocument());
    const gizmo = await canvas.findByRole("option", { name: /Gizmo/ });
    await waitFor(async () => expect(gizmo).toHaveAttribute("data-selection", "associated"));
  },
};

/** A locked field ignores "Clear all"; its chip keeps a lock glyph. */
export const LockedFieldSurvivesClearAll: Story = {
  name: "Locked field survives Clear all",
  render: () => {
    const driver = createLocalSelectionDriver();
    driver.register("rows", ROWS, ["Region", "Product"]);
    driver.select("Region", ["EMEA"], { replace: true });
    driver.lock("Region", true);
    driver.select("Product", ["Gadget"], { replace: true });
    return (
      <div className="flex h-[520px] flex-col gap-3">
        <DashboardProvider
          spec={buildSpec()}
          driver={driver}
          tiles={[filterTileKind, regionBarKind, productBarKind]}
        >
          <DashboardSelectionBar driver={driver} />
          <div className="min-h-0 flex-1">
            <DashboardSheet />
          </div>
        </DashboardProvider>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bar = await canvas.findByRole("toolbar", { name: "Selections" });
    await userEvent.click(within(bar).getByRole("button", { name: "Clear all" }));
    // Region (locked) survives; Product (unlocked) clears.
    await waitFor(() => expect(within(bar).getByText("Region")).toBeInTheDocument());
    await waitFor(() => expect(within(bar).queryByText("Product")).not.toBeInTheDocument());
  },
};

/** The Bookmarks menu applies a saved selection and offers "Save bookmark…". */
export const Bookmarks: Story = {
  render: () => {
    const driver = createLocalSelectionDriver();
    driver.register("rows", ROWS, ["Region", "Product"]);
    let saved: [SelectionSnapshot, Readonly<Record<string, VariableValue>>] | null = null;
    return (
      <div className="flex h-[520px] flex-col gap-3">
        <DashboardProvider
          spec={buildSpec()}
          driver={driver}
          tiles={[filterTileKind, regionBarKind, productBarKind]}
        >
          <DashboardSelectionBar
            driver={driver}
            onSaveBookmark={(snapshot, variables) => {
              saved = [snapshot, variables];
            }}
          />
          <div className="min-h-0 flex-1">
            <DashboardSheet />
          </div>
        </DashboardProvider>
        <span data-testid="saved-probe" data-saved={saved ? "yes" : "no"} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // `DropdownMenuContent` portals to `document.body`, outside `canvasElement` — the
    // established pattern (`dropdown-menu.stories.tsx`, `dashboard-sheet.stories.tsx`).
    const body = within(document.body);
    const bar = await canvas.findByRole("toolbar", { name: "Selections" });
    await userEvent.click(within(bar).getByRole("button", { name: "Bookmarks" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "EMEA focus" }));
    await waitFor(() => expect(within(bar).getByText("Region")).toBeInTheDocument());
    // The menu's exit animation clears Radix's background `aria-hidden` a tick after the
    // click resolves — wait for it to fully close before the play function (and axe) ends.
    await waitFor(() => expect(body.queryByRole("menu")).not.toBeInTheDocument());

    await userEvent.click(within(bar).getByRole("button", { name: "Bookmarks" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Save bookmark…" }));
    await waitFor(() => expect(body.queryByRole("menu")).not.toBeInTheDocument());
  },
};

/**
 * `bookmarks` stays `true` and a bookmark already exists, but no `onSaveBookmark` is passed:
 * "Save bookmark…" would be a dead control, so it is omitted — the existing bookmark still
 * applies normally.
 */
export const SaveBookmarkOmittedWithoutHandler: Story = {
  name: "Save bookmark hidden (no handler)",
  render: () => {
    const driver = createLocalSelectionDriver();
    driver.register("rows", ROWS, ["Region", "Product"]);
    return (
      <DashboardProvider
        spec={buildSpec()}
        driver={driver}
        tiles={[filterTileKind, regionBarKind, productBarKind]}
      >
        <DashboardSelectionBar driver={driver} />
      </DashboardProvider>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    const bar = await canvas.findByRole("toolbar", { name: "Selections" });
    await userEvent.click(within(bar).getByRole("button", { name: "Bookmarks" }));
    await expect(await body.findByRole("menuitem", { name: "EMEA focus" })).toBeInTheDocument();
    await expect(body.queryByRole("menuitem", { name: "Save bookmark…" })).not.toBeInTheDocument();
  },
};

/** No bookmarks configured: the `bookmarks` prop hides the menu entirely. */
export const NoBookmarksMenu: Story = {
  name: "Bookmarks hidden",
  render: () => {
    const driver = createLocalSelectionDriver();
    driver.register("rows", ROWS, ["Region", "Product"]);
    return (
      <DashboardProvider
        spec={buildSpec()}
        driver={driver}
        tiles={[filterTileKind, regionBarKind, productBarKind]}
      >
        <DashboardSelectionBar driver={driver} bookmarks={false} />
      </DashboardProvider>
    );
  },
  play: async ({ canvasElement }) => {
    const bar = await within(canvasElement).findByRole("toolbar", { name: "Selections" });
    await expect(within(bar).queryByRole("button", { name: "Bookmarks" })).not.toBeInTheDocument();
  },
};
