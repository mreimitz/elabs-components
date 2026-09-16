import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import type { DashboardSpec, TileSpec } from "../core/spec";
import { createDashboardStore, type DashboardStore } from "../core/store";
import {
  DEFAULT_DASHBOARD_LABELS,
  DashboardProvider,
  DashboardSheet,
  createTileRegistry,
} from "../dashboard-sheet";
import { DashboardContext, useDashboardContext } from "../dashboard-sheet/use-dashboard";
import { bigFortySpec } from "../fixtures/big-40";
import { builtInTiles } from "../tiles";
import {
  DashboardInteractionsDialog,
  DashboardInteractionsEditor,
} from "./dashboard-interactions-editor";
import { DashboardSelectionBar } from "./dashboard-selection-bar";

declare global {
  interface Window {
    /** Installed by the dashboard stories so plays read the real store. */
    __dashboardStore?: DashboardStore;
  }
}

const REGIONS = ["EMEA", "APAC", "AMER"];

const chart = (
  id: string,
  title: string,
  series: string,
  x: number,
  wiring: Pick<TileSpec, "consumes" | "emits">,
): TileSpec => ({
  id,
  kind: "chart",
  title,
  layout: { x, y: 0, w: 5, h: 6 },
  ...wiring,
  content: {
    type: "bar",
    x: "Region",
    series: [series],
    data: REGIONS.map((Region, i) => ({ Region, [series]: 10 + i * 4 })),
  },
});

/** A (emits) → B `filter`, C `highlight`, D `none`, plus a global Region filter tile. */
function interactionsSpec(): DashboardSpec {
  return {
    version: 1,
    id: "interactions-demo",
    title: "Where revenue comes from",
    grid: { mode: "fit", columns: 24, rows: 12, gap: 8 },
    tiles: [
      chart("chart-1", "Revenue by region", "revenue", 0, { emits: { selection: ["Region"] } }),
      chart("table-1", "Deals by region", "deals", 5, { consumes: { selection: true } }),
      chart("chart-2", "Margin by region", "margin", 10, { consumes: { selection: true } }),
      chart("chart-4", "Churn by region", "churn", 15, { consumes: { selection: true } }),
      {
        id: "filter-1",
        kind: "filter",
        title: "Region filter",
        layout: { x: 20, y: 0, w: 4, h: 12 },
        content: { field: "Region", values: REGIONS.map((value) => ({ value })) },
      },
    ],
    interactions: [
      { from: "chart-1", to: "*", effect: "highlight" },
      { from: "chart-1", to: "table-1", effect: "filter" },
      { from: "chart-1", to: "chart-4", effect: "none" },
    ],
  };
}

function StoreProbe() {
  window.__dashboardStore = useDashboardContext().store;
  return null;
}

function Sheet({ spec, editor }: { spec: DashboardSpec; editor?: boolean }) {
  return (
    <DashboardProvider spec={spec} tiles={builtInTiles}>
      <StoreProbe />
      <div className="flex w-full min-w-0 flex-col gap-3">
        <DashboardSelectionBar />
        <div data-testid="host" className="h-[360px] w-full">
          <DashboardSheet renderAll />
        </div>
        {editor ? <DashboardInteractionsEditor /> : null}
      </div>
    </DashboardProvider>
  );
}

const meta = {
  title: "Dashboard/Interactions",
  component: DashboardInteractionsEditor,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof DashboardInteractionsEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

const tileEl = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-tile-id="${id}"]`)!;
const states = (root: HTMLElement, id: string) =>
  Array.from(tileEl(root, id).querySelectorAll("[data-selection]"), (n) =>
    n.getAttribute("data-selection"),
  ).join(",");
const firstBar = async (root: HTMLElement, id: string) => {
  let bar: HTMLElement | null = null;
  await waitFor(() => {
    bar = tileEl(root, id).querySelector<HTMLElement>('[data-slot="chart-datapoint-layer-target"]');
    expect(bar).not.toBeNull();
  });
  return bar as unknown as HTMLElement;
};
/** Activate a bar's datapoint target (the chart's keyboard path; the layer is `pointer-events: none`). */
const activate = async (bar: HTMLElement) => {
  bar.focus();
  await userEvent.keyboard("{Enter}");
};

/**
 * Clicking a bar in `chart-1` FILTERS `table-1` (a real selection, a chip) and only HIGHLIGHTS
 * `chart-2` (`data-highlighted`, excluded marks); `chart-4` (`none`) stays untouched. The Region
 * filter tile writes globally, so its click filters everything.
 */
export const HighlightVsFilter: Story = {
  name: "Highlight vs filter",
  render: () => <Sheet spec={interactionsSpec()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bar = await firstBar(canvasElement, "chart-1");
    const untouched = states(canvasElement, "chart-4");
    await activate(bar);

    await waitFor(() => expect(states(canvasElement, "table-1")).toContain("excluded"));
    await waitFor(() => expect(states(canvasElement, "chart-2")).toContain("excluded"));
    await expect(tileEl(canvasElement, "chart-2")).toHaveAttribute("data-highlighted", "");
    await expect(tileEl(canvasElement, "table-1")).not.toHaveAttribute("data-highlighted");
    const state = window.__dashboardStore!.getState();
    await expect(state.selection.fields.Region?.values).toEqual(["EMEA"]);
    await expect(state.selectionOrigins).toEqual({ Region: "chart-1" });
    await expect([...(state.highlight?.targets ?? [])]).toEqual(["chart-2"]);
    // `none`: the target's DOM selection states did not change.
    await expect(states(canvasElement, "chart-4")).toBe(untouched);
    await expect(states(canvasElement, "chart-4")).not.toContain("excluded");

    // The global filter tile: the chip stays and `chart-4` now filters too.
    await activate(bar);
    await waitFor(() => expect(window.__dashboardStore!.getState().selection.count()).toBe(0));
    const bars = canvas.getByRole("toolbar", { name: "Selections" });
    await userEvent.click(await canvas.findByRole("option", { name: /APAC/ }));
    await waitFor(() => expect(within(bars).getByText("Region")).toBeInTheDocument());
    await waitFor(() => expect(states(canvasElement, "chart-4")).toContain("excluded"));
    await expect(window.__dashboardStore!.getState().highlight).toBeNull();
  },
};

const onNavigate = fn();

/** A `drill` pair calls the host's `onNavigate(sheetId, { carry })` (D5: the host routes). */
export const Drill: Story = {
  render: () => {
    function DrillSheet() {
      const [store] = useState(() =>
        createDashboardStore({
          spec: {
            ...interactionsSpec(),
            interactions: [
              {
                from: "chart-1",
                to: "*",
                effect: { drill: { sheetId: "sheet-2", carry: ["Region"] } },
              },
            ],
          },
          onNavigate,
        }),
      );
      const value = useMemo(
        () => ({
          store,
          registry: createTileRegistry(builtInTiles),
          labels: DEFAULT_DASHBOARD_LABELS,
          onNavigate: (sheetId: string) => onNavigate(sheetId),
        }),
        [store],
      );
      window.__dashboardStore = store;
      return (
        <DashboardContext.Provider value={value}>
          <div data-testid="host" className="h-[360px] w-full">
            <DashboardSheet renderAll />
          </div>
        </DashboardContext.Provider>
      );
    }
    return <DrillSheet />;
  },
  play: async ({ canvasElement }) => {
    onNavigate.mockClear();
    await activate(await firstBar(canvasElement, "chart-1"));
    await waitFor(() =>
      expect(onNavigate).toHaveBeenCalledWith("sheet-2", { carry: { Region: ["EMEA"] } }),
    );
    await expect(window.__dashboardStore!.getState().selection.count()).toBe(0);
  },
};

/**
 * The matrix: setting `chart-1 → chart-2` to None writes one explicit pair as ONE history entry;
 * the same click then leaves `chart-2` unchanged.
 */
export const MatrixEditor: Story = {
  render: () => <Sheet spec={interactionsSpec()} editor />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole("combobox", {
      name: "Revenue by region → Margin by region: Highlight",
    });
    await expect(canvas.getByRole("table")).toBeInTheDocument();
    const store = window.__dashboardStore!;
    const past = store.getState().history.past;
    await userEvent.click(trigger);
    await userEvent.click(await within(document.body).findByRole("option", { name: "None" }));
    await waitFor(() => expect(store.getState().history.past).toBe(past + 1));
    await expect(store.getState().spec.interactions).toContainEqual({
      from: "chart-1",
      to: "chart-2",
      effect: "none",
    });
    await canvas.findByRole("combobox", { name: "Revenue by region → Margin by region: None" });

    const before = states(canvasElement, "chart-2");
    await activate(await firstBar(canvasElement, "chart-1"));
    await waitFor(() => expect(states(canvasElement, "table-1")).toContain("excluded"));
    await expect(states(canvasElement, "chart-2")).toBe(before);
    await expect(store.getState().history.past).toBe(past + 1);
  },
};

/** More than 12 tiles: the editor lists pairs grouped by emitter. */
export const ListForBig40: Story = {
  name: "List (big40)",
  render: () => {
    const spec: DashboardSpec = {
      ...bigFortySpec,
      tiles: bigFortySpec.tiles.map((tile, i) =>
        tile.kind === "chart"
          ? {
              ...tile,
              ...(i % 2 === 0 ? { emits: { selection: ["Region"] } } : {}),
              consumes: { selection: true },
            }
          : tile,
      ),
    };
    return (
      <DashboardProvider spec={spec} tiles={builtInTiles}>
        <DashboardInteractionsEditor className="max-h-[480px] overflow-auto" />
      </DashboardProvider>
    );
  },
  play: async ({ canvasElement }) => {
    const editor = canvasElement.querySelector('[data-slot="dashboard-interactions-editor"]');
    await expect(editor).toHaveAttribute("data-layout", "list");
    await expect(within(canvasElement).queryByRole("table")).toBeNull();
    await expect(within(canvasElement).getAllByRole("combobox").length).toBeGreaterThan(0);
  },
};

/** The properties panel's "Edit interactions…" entry, scoped to one emitter. */
export const Dialog: Story = {
  render: () => (
    <DashboardProvider spec={interactionsSpec()} tiles={builtInTiles}>
      <DashboardInteractionsDialog
        triggerLabel="Edit interactions…"
        tileId="chart-1"
        sheets={[{ id: "sheet-2", label: "Region detail" }]}
      />
    </DashboardProvider>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Edit interactions…" }),
    );
    const dialog = await within(document.body).findByRole("dialog", { name: "Edit interactions" });
    await expect(within(dialog).getAllByRole("combobox")).toHaveLength(3);
  },
};
