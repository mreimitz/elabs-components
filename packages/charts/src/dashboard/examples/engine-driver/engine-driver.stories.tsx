/**
 * "Dashboard / Recipes / External engine driver" (RM-085, #433) — the `sales-overview`-style
 * sheet driven ENTIRELY by `createEngineDriver` (`./create-engine-driver.ts`) over a
 * `createMockEngine` (`./mock-engine.ts`): an asynchronous, self-historied stand-in for a host's
 * own associative selection engine. The "Engine state" panel renders the engine's raw
 * `getStates()` output so the story proves what the module docs claim — the sheet never computes
 * selection itself; it only ever reads what the driver hands back.
 */
import { useEffect, useMemo, useReducer, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import type { DashboardSpec } from "../../core/spec";
import { DashboardSelectionBar } from "../../chrome";
import { DashboardProvider, DashboardSheet } from "../../dashboard-sheet";
import { withBuiltInTiles } from "../../tiles/built-in-tiles";
import { createEngineDriver } from "./create-engine-driver";
import { createMockEngine, type MockEngine } from "./mock-engine";

const ENGINE_SPEC: DashboardSpec = {
  version: 1,
  id: "engine-driver-recipe",
  title: "Driven by an external engine",
  description:
    "Every selection below goes through a mock associative engine, not the bundled local driver.",
  grid: { mode: "fit", columns: 24, rows: 9, gap: 8 },
  tiles: [
    {
      id: "region-filter",
      kind: "filter",
      layout: { x: 0, y: 0, w: 6, h: 9 },
      title: "Region",
      content: {
        field: "Region",
        label: "Region",
        values: [{ value: "EMEA" }, { value: "APAC" }, { value: "AMER" }],
      },
    },
    {
      id: "chart-1",
      kind: "chart",
      layout: { x: 6, y: 0, w: 9, h: 9 },
      title: "Revenue by region",
      content: {
        type: "bar",
        data: [
          { Region: "EMEA", revenue: 41 },
          { Region: "APAC", revenue: 33 },
          { Region: "AMER", revenue: 26 },
        ],
        x: "Region",
        series: [{ key: "revenue", label: "Revenue" }],
      },
      consumes: { selection: ["Region"] },
      emits: { selection: ["Region"] },
    },
    {
      id: "chart-2",
      kind: "chart",
      layout: { x: 15, y: 0, w: 9, h: 9 },
      title: "Revenue by region, detail view",
      content: {
        type: "line",
        data: [
          { Region: "EMEA", revenue: 18 },
          { Region: "APAC", revenue: 14 },
          { Region: "AMER", revenue: 10 },
        ],
        x: "Region",
        series: [{ key: "revenue", label: "Revenue" }],
      },
      // `chart-2` only CONSUMES — it never emits, so it is the tile whose dimming proves the
      // driver's selection reached a tile that never clicked anything itself.
      consumes: { selection: ["Region"] },
    },
  ],
};

/**
 * Renders the engine's own `getStates()` verbatim — nothing here is derived from the sheet's
 * selection. Re-renders on every `engine.onChange`, the same signal `createEngineDriver`
 * forwards as the `SelectionDriver`'s `subscribe`.
 */
function EngineStatePanel({ engine }: { engine: MockEngine }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => engine.onChange(() => rerender()), [engine]);
  return (
    <div
      data-testid="engine-state-panel"
      role="status"
      aria-live="polite"
      className="flex h-full flex-col gap-2 overflow-auto rounded-lg border border-border-strong bg-card p-3"
    >
      <span className="text-meta font-medium text-foreground">
        Engine state (raw — the sheet never computes this)
      </span>
      <pre className="min-h-0 flex-1 whitespace-pre-wrap text-code text-muted-foreground">
        {JSON.stringify(engine.getStates(), null, 2)}
      </pre>
    </div>
  );
}

function EngineDriverRecipe() {
  const [engine] = useState<MockEngine>(() =>
    createMockEngine([{ Region: "EMEA" }, { Region: "APAC" }, { Region: "AMER" }], ["Region"]),
  );
  const [driver] = useState(() => createEngineDriver(engine));
  const tiles = useMemo(() => withBuiltInTiles({}), []);

  return (
    <div data-testid="host" className="flex h-[560px] max-h-[85vh] w-full flex-col gap-3">
      <DashboardProvider spec={ENGINE_SPEC} driver={driver} tiles={tiles}>
        <DashboardSelectionBar driver={driver} />
        <div className="flex min-h-0 flex-1 gap-3">
          <div className="min-w-0 flex-1">
            <DashboardSheet />
          </div>
          <div className="w-64 shrink-0">
            <EngineStatePanel engine={engine} />
          </div>
        </div>
      </DashboardProvider>
    </div>
  );
}

const meta = {
  title: "Dashboard/Recipes/External engine driver",
  component: EngineDriverRecipe,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof EngineDriverRecipe>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const back = await canvas.findByRole("button", { name: "Step back" });
    await expect(back).toBeDisabled();

    const emea = await canvas.findByRole("option", { name: "EMEA" });
    await userEvent.click(emea);

    // The engine resolves ASYNCHRONOUSLY (its own `onChange`, not a synchronous store write) —
    // every assertion below is inside a `waitFor` for exactly that reason.
    await waitFor(() => expect(back).not.toBeDisabled());
    await expect(back).toHaveAttribute("aria-label", "Step back");

    const chart2 = canvasElement.querySelector('[data-tile-id="chart-2"]') as HTMLElement;
    await waitFor(() => {
      expect(chart2.querySelectorAll('[data-selection="excluded"]').length).toBeGreaterThan(0);
    });
    expect(chart2.querySelectorAll('[data-selection="selected"]').length).toBeGreaterThan(0);

    const panel = canvas.getByTestId("engine-state-panel");
    await waitFor(() => expect(panel.textContent).toContain("selected"));

    // Step back through the ENGINE's own history — the store mirrors it, and the button's
    // enabled state mirrors `engine.canBack()` throughout (`DashboardSelectionBar`'s `driver` prop).
    await userEvent.click(back);
    await waitFor(() => expect(back).toBeDisabled());
    await waitFor(() => {
      expect(chart2.querySelectorAll('[data-selection="excluded"]').length).toBe(0);
    });
  },
};
