import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { expect, userEvent, waitFor } from "storybook/test";
import type { DashboardSpec } from "@elabs-ai/components-charts/dashboard";
import { DashboardProvider, DashboardSheet } from "@elabs-ai/components-charts/dashboard";
import { generateSyntheticLog } from "@elabs-ai/components-process/core";
import { processMapTileKind } from "@/components/dashboard-tile-process-map/dashboard-tile-process-map";

/**
 * Renders the SHIPPED registry block (`@/components/…` maps to `registry/blocks`), a
 * `DashboardTileKind` for the sheet's `process-map` tile. See `.claude/rules/registry.md`.
 */
const log = generateSyntheticLog({ cases: 60, seed: 7 });

const SPEC: DashboardSpec = {
  version: 1,
  id: "process-map-tile-demo",
  grid: { mode: "fit", columns: 12, rows: 10, gap: 8 },
  tiles: [
    {
      id: "map-1",
      kind: "process-map",
      title: "Process",
      layout: { x: 0, y: 0, w: 12, h: 10 },
      content: { field: "activity", log, metric: { node: "absolute", edge: "absolute" } },
    },
  ],
};

function ProcessMapTileDemo() {
  return (
    <div className="h-[480px] w-full min-w-[640px]">
      <DashboardProvider spec={SPEC} tiles={[processMapTileKind]}>
        <DashboardSheet renderAll />
      </DashboardProvider>
    </div>
  );
}

const meta = {
  title: "Dashboard/Recipes/Tile — Process map",
  component: ProcessMapTileDemo,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta<typeof ProcessMapTileDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Clicking an activity node selects it; every other activity ghosts as `excluded`. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const nodes = () =>
      canvasElement.querySelectorAll('[data-slot="dashboard-tile-process-map"] .react-flow__node');
    // The flow canvas lays out after mount; wait for its nodes instead of reading them at once.
    await waitFor(() => expect(nodes().length).toBeGreaterThan(0));

    const first = nodes()[0] as HTMLElement;
    await userEvent.click(first);

    // Scoped to `.react-flow__node` — `ProcessMap` also keeps a visually-hidden `Table`
    // twin of the same rows for accessibility (data.md "tableView is the accessible twin
    // every canvas keeps"), which carries its own `data-selection` per row; an unscoped
    // query would double-count every element.
    const selected = canvasElement.querySelectorAll(
      '[data-slot="dashboard-tile-process-map"] .react-flow__node [data-selection="selected"]',
    );
    const excluded = canvasElement.querySelectorAll(
      '[data-slot="dashboard-tile-process-map"] .react-flow__node [data-selection="excluded"]',
    );
    // "1 node selected, the rest excluded once an activity is clicked"
    await expect(selected.length).toBe(1);
    await expect(excluded.length).toBe(nodes().length - 1);
  },
};
