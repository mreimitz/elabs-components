import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@elabs-ai/components-ui";
import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { BarValueAxis } from "../bar-value-axis";
import { BarXAxis } from "../bar-x-axis";
import { Grid } from "../grid";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { Scatter } from "../scatter";
import { ScatterChart } from "../scatter-chart";
import { XAxis } from "../x-axis";
import { YAxis } from "../y-axis";
import {
  createLocalSelectionDriver,
  type LocalSelectionDriver,
  useSelectionDriver,
} from "./local-selection-driver";

/**
 * **Linked charts on one local driver** (RM-145).
 *
 * A bar chart, a line chart and a scatter share ONE
 * `createLocalSelectionDriver()`: each chart's `onSelectionIntent` goes to
 * `apply` (`replace` / `toggle` / `add` → `select(field, values, flags)`),
 * and each paints `selectionStates` from the driver's snapshot — `selected`
 * in the selection, `excluded` (dimmed, dashed frame) when the field carries
 * a selection without the value, `associated` otherwise.
 *
 * - **Scatter** (margin vs revenue, one point per region): lasso in
 *   `explicit` confirm — the preview paints the lassoed regions, ✓ commits
 *   them to the driver and the bars and the line's columns outside the lasso
 *   are dimmed.
 * - **Bars**: click replaces, **Ctrl/Cmd+click** toggles a region, Shift+click
 *   adds, Range on the axis selects a run of regions.
 * - **Clear** empties the driver.
 *
 * The driver has the parked dashboard core's `select` / `clear` / `states`
 * shape, so the dashboard pack can replace it wholesale; history and locks are
 * the pack's job.
 */
const meta = {
  title: "Charts/Selection/Linked charts",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Three charts on one selection: a lasso in the scatter or a click in the bars goes to `createLocalSelectionDriver()`, and every chart paints the result through `selectionStates` — selected, excluded (dimmed) or associated. The driver has the `select` / `clear` / `getSnapshot` shape a host selection engine can replace.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const REGIONS = [
  { region: "North", revenue: 42, margin: 12, growth: 3 },
  { region: "East", revenue: 118, margin: 22, growth: 7 },
  { region: "South", revenue: 67, margin: 9, growth: -2 },
  { region: "West", revenue: 131, margin: 18, growth: 5 },
  { region: "Central", revenue: 96, margin: 15, growth: 4 },
  { region: "Coast", revenue: 154, margin: 26, growth: 9 },
  { region: "Valley", revenue: 31, margin: 6, growth: -4 },
  { region: "Harbor", revenue: 173, margin: 24, growth: 11 },
];

/** The last driver a story rendered — the play function reads its snapshot. */
let currentDriver: LocalSelectionDriver | null = null;

function LinkedCharts() {
  const [driver] = useState(createLocalSelectionDriver);
  currentDriver = driver;
  const { snapshot, selectionStates, apply } = useSelectionDriver(driver, { field: "region" });
  const selected = snapshot.fields.region?.values ?? [];
  return (
    <div className="flex w-full max-w-[1100px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={selected.length === 0}
          onClick={() => driver.clear()}
          size="sm"
          variant="outline"
        >
          Clear
        </Button>
        <span className="text-meta text-muted-foreground" data-testid="selection-summary">
          {selected.length > 0 ? `region: ${selected.join(", ")}` : "No selection"}
        </span>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0" data-testid="bars">
          <BarChart
            accessibleLabel="Revenue by region"
            animationDuration={0}
            data={REGIONS}
            onSelectionIntent={apply}
            selectionGestures={["range"]}
            selectionStates={selectionStates}
            xDataKey="region"
          >
            <Grid horizontal />
            <Bar dataKey="revenue" />
            <BarXAxis />
            <BarValueAxis />
          </BarChart>
        </div>
        <div className="min-w-0" data-testid="line">
          <LineChart
            accessibleLabel="Growth by region"
            animationDuration={0}
            data={REGIONS}
            selectionStates={selectionStates}
            xDataKey="region"
            xScale="band"
          >
            <Grid horizontal />
            <Line dataKey="growth" />
            <XAxis />
            <YAxis />
          </LineChart>
        </div>
        <div className="min-w-0 lg:col-span-2" data-testid="scatter">
          <ScatterChart
            accessibleLabel="Margin against revenue, one point per region"
            animationDuration={0}
            data={REGIONS}
            onSelectionIntent={apply}
            selectionConfirm="explicit"
            selectionField="region"
            selectionGestures={["lasso", "rect"]}
            selectionStates={selectionStates}
            xDataKey="revenue"
            xScale="linear"
          >
            <Grid horizontal />
            <Scatter dataKey="margin" />
            <XAxis />
            <YAxis />
          </ScatterChart>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function frame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function fire(
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  x: number,
  y: number,
  init: PointerEventInit = {},
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      ...init,
    }),
  );
}

async function plotOf(root: HTMLElement): Promise<{ plot: Element; box: DOMRect }> {
  await waitFor(() =>
    expect(root.querySelector('[data-slot="chart-selection-gesture"]')).not.toBeNull(),
  );
  await new Promise((resolve) => setTimeout(resolve, 150));
  const plot = root.querySelector('[data-slot="chart-selection-gesture"]')!.parentElement!;
  return { plot, box: (plot.firstElementChild ?? plot).getBoundingClientRect() };
}

const at = (box: DOMRect, fx: number, fy: number) =>
  [box.left + box.width * fx, box.top + box.height * fy] as const;

/** The bar chart's painted state per region, in data order. */
function barStates(root: HTMLElement): (string | null)[] {
  return [...root.querySelectorAll('[data-slot="chart-selection-mark"]')].map((mark) =>
    mark.getAttribute("data-selection"),
  );
}

/** What the driver says each region's bar should paint. */
function driverStates(): string[] {
  const snapshot = currentDriver!.getSnapshot();
  return REGIONS.map((row) => snapshot.states("region", row.region));
}

// ---------------------------------------------------------------------------
// Story
// ---------------------------------------------------------------------------

export const LassoLinksBarsAndLine: Story = {
  render: () => <LinkedCharts />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bars = canvas.getByTestId("bars");
    const scatter = canvas.getByTestId("scatter");

    // Nothing selected: every bar resolves `associated`.
    await waitFor(() => expect(barStates(bars)).toHaveLength(REGIONS.length));
    await expect(barStates(bars).every((state) => state === "associated")).toBe(true);

    // A lasso over the left half of the scatter (the low-revenue regions).
    const { plot, box } = await plotOf(scatter);
    const path: Array<[number, number]> = [
      [0.01, 0.01],
      [0.45, 0.01],
      [0.45, 0.99],
      [0.01, 0.99],
      [0.012, 0.02],
    ];
    const [first, ...rest] = path.map(([fx, fy]) => at(box, fx, fy));
    fire(plot, "pointerdown", first![0], first![1]);
    for (const [x, y] of rest) {
      fire(plot, "pointermove", x, y);
      await frame();
    }
    fire(plot, "pointerup", rest.at(-1)![0], rest.at(-1)![1]);

    // Provisional: the driver is untouched until ✓.
    await waitFor(() =>
      expect(scatter.querySelector('[data-slot="chart-selection-root"]')).toHaveAttribute(
        "data-selection-provisional",
        "true",
      ),
    );
    await expect(currentDriver!.getSnapshot().count()).toBe(0);
    await userEvent.click(within(scatter).getByRole("button", { name: "Confirm selection" }));

    // Committed: the bars paint exactly what the driver resolves.
    await waitFor(() => expect(currentDriver!.getSnapshot().count("region")).toBeGreaterThan(0));
    const expected = driverStates();
    await expect(expected).toContain("selected");
    await expect(expected).toContain("excluded");
    await waitFor(() => expect(barStates(bars)).toEqual(expected));
    // The lasso took the low-revenue regions.
    const lassoed = currentDriver!.getSnapshot().fields.region!.values;
    await expect(lassoed).toContain("Valley");
    await expect(lassoed).not.toContain("Harbor");
    // The line's columns dim with them.
    const line = canvas.getByTestId("line");
    await waitFor(() => expect(line.querySelector('[data-selection="excluded"]')).not.toBeNull());

    // Ctrl+click Harbor's bar toggles it IN (bars are `immediate`).
    const { plot: barPlot, box: barBox } = await plotOf(bars);
    const harbor = REGIONS.findIndex((row) => row.region === "Harbor");
    const [hx, hy] = at(barBox, (harbor + 0.5) / REGIONS.length, 0.97);
    fire(barPlot, "pointerdown", hx, hy, { ctrlKey: true });
    fire(barPlot, "pointerup", hx, hy, { ctrlKey: true });
    await waitFor(() => expect(barStates(bars)[harbor]).toBe("selected"));
    await expect(currentDriver!.getSnapshot().fields.region!.values).toContain("Harbor");
    // …and a second Ctrl+click toggles it back out.
    fire(barPlot, "pointerdown", hx, hy, { ctrlKey: true });
    fire(barPlot, "pointerup", hx, hy, { ctrlKey: true });
    await waitFor(() => expect(barStates(bars)[harbor]).toBe("excluded"));

    // Clear empties the driver; every bar is associated again.
    await userEvent.click(canvas.getByRole("button", { name: "Clear" }));
    await waitFor(() =>
      expect(barStates(bars).every((state) => state === "associated")).toBe(true),
    );
    await expect(canvas.getByTestId("selection-summary")).toHaveTextContent("No selection");
  },
};
