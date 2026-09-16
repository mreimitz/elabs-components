import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { expect, waitFor, within } from "storybook/test";
import { discoverGraph } from "../core/discover-graph";
import { liftHappyPath } from "../core/reference-model";
import { tokenReplay } from "../core/token-replay";
import { CONFORMANCE_FIXTURE_LOG, CONFORMANCE_FIXTURE_PATH } from "./conformance-fixture";
import { ConformanceLegend } from "./conformance-legend";
import { ConformanceOverlay } from "./conformance-overlay";

const graph = discoverGraph(CONFORMANCE_FIXTURE_LOG);
const conformance = tokenReplay(CONFORMANCE_FIXTURE_LOG, liftHappyPath(CONFORMANCE_FIXTURE_PATH));

const meta = {
  title: "Process/ConformanceOverlay",
  component: ConformanceOverlay,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A `ProcessMap` painted with a token-replay result: every activity and transition " +
          "is `both` (in log and model), `logOnly` (the log does it, the model does not) or " +
          "`modelOnly` (the model expects it, cases skipped it). Each state carries a status " +
          "tone, a glyph, a line style and a word in its accessible name — never colour alone. " +
          "`data-conformance` is added beside `data-selection`, never in place of it.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-[40rem] w-full bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: { graph, conformance },
} satisfies Meta<typeof ConformanceOverlay>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The canvas: glyph marker + frame dash per activity, dash + pill glyph per transition. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(canvasElement.querySelectorAll(".react-flow__node[data-conformance]").length).toBe(
          graph.activities.length,
        ),
      { timeout: 5000 },
    );
    // Every state on the canvas pairs with ONE glyph and ONE dash, and no two states share
    // either — the greyscale test, asserted.
    const glyphByState = new Map<string, string>();
    const dashByState = new Map<string, string>();
    for (const marker of canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot="process-activity-node-conformance"]',
    )) {
      const state = marker.closest("[data-conformance]")!.getAttribute("data-conformance")!;
      const glyph = marker.getAttribute("data-glyph")!;
      const dash = marker.getAttribute("data-dash")!;
      if (glyphByState.has(state)) await expect(glyphByState.get(state)).toBe(glyph);
      glyphByState.set(state, glyph);
      dashByState.set(state, dash);
    }
    await expect([...glyphByState.keys()].sort()).toEqual(["both", "logOnly", "modelOnly"]);
    await expect(new Set(glyphByState.values()).size).toBe(3);
    await expect(new Set(dashByState.values()).size).toBe(3);

    const skipped = canvasElement.querySelector('.react-flow__node[data-id="Check credit"]')!;
    await expect(skipped).toHaveAttribute("data-conformance", "modelOnly");
    await expect(skipped.getAttribute("aria-label")).toMatch(/Model only/);

    const legend = within(canvasElement).getByRole("group", { name: "Conformance" });
    await expect(within(legend).getAllByRole("listitem")).toHaveLength(3);
  },
};

/** The accessible twin: a Conformance column whose cell prints the glyph and the word. */
export const TableView: Story = {
  args: { tableView: true },
  decorators: [
    (Story) => (
      <div className="h-[40rem] w-full overflow-auto">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const activities = await canvas.findByRole("table", { name: /Activities/ });
    await expect(
      within(activities).getByRole("columnheader", { name: "Conformance" }),
    ).toBeVisible();
    const row = within(activities).getByRole("row", { name: /Check credit/ });
    await expect(row).toHaveAttribute("data-conformance", "modelOnly");
    await expect(within(row).getByText(/Model only/)).toBeVisible();
  },
};

/** No replay yet — the map's own loading panel; the legend waits with it. */
export const Loading: Story = {
  args: { loading: true },
};

/** The legend on its own, for a toolbar or side panel beside the map. */
export const Legend: Story = {
  render: () => <ConformanceLegend />,
  play: async ({ canvasElement }) => {
    const items = canvasElement.querySelectorAll('[data-slot="conformance-legend-item"]');
    await expect(items).toHaveLength(3);
    await expect(new Set([...items].map((item) => item.getAttribute("data-glyph"))).size).toBe(3);
    await expect(new Set([...items].map((item) => item.getAttribute("data-dash"))).size).toBe(3);
  },
};
