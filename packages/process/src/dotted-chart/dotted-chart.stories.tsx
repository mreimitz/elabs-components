import type { Meta, StoryObj } from "@storybook/react-vite";
import { useCallback, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { activityColorScale } from "../core/activity-color-scale";
import { discoverGraph } from "../core/discover-graph";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import type { EventLog } from "../core/types";
import { computeDots } from "./compute-dots";
import { DottedChart, type DottedChartProps } from "./dotted-chart";

const log = generateSyntheticLog({ cases: 300, seed: 42 });
const colorScale = activityColorScale(discoverGraph(log));
const rows = computeDots(log).rows;

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 0, 5, 9);
/** Three short cases — small enough that a play function can aim at a known dot. */
const tinyLog: EventLog = {
  events: [
    { caseId: "order-1", activity: "Create Order", timestamp: T0 },
    { caseId: "order-1", activity: "Ship Order", timestamp: T0 + 6 * HOUR },
    { caseId: "order-2", activity: "Create Order", timestamp: T0 + 2 * HOUR },
    { caseId: "order-2", activity: "Ship Order", timestamp: T0 + 9 * HOUR },
    { caseId: "order-3", activity: "Create Order", timestamp: T0 + 4 * HOUR },
    { caseId: "order-3", activity: "Cancel Order", timestamp: T0 + 12 * HOUR },
  ],
};

/** Owns the selection a playbook would own, so the stories are interactive. */
function Stateful({
  initialSelected = [],
  onSelect,
  ...props
}: DottedChartProps & { initialSelected?: string[] }) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const handleSelect = useCallback(
    (ids: string[]) => {
      setSelected(ids);
      onSelect?.(ids);
    },
    [onSelect],
  );
  return <DottedChart {...props} selectedCaseIds={selected} onSelect={handleSelect} />;
}

const meta = {
  title: "Process/DottedChart",
  component: DottedChart,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "One row per case, one dot per event, coloured by activity with the same scale " +
          "`ProcessMap` and `VariantExplorer` read. Built on the charts canvas mark layer inside " +
          "`ChartFrame`, so 100k dots stay one canvas with one keyboard cursor and a spoken " +
          "summary. Click a dot or press Enter on a row to select a case; drag a rectangle to " +
          'emit a `{ kind: "cases" }` filter intent. The chart never filters itself.',
      },
    },
  },
  args: {
    log,
    colorScale,
    title: "Order-to-cash cases over time",
    description: "Each row is a case, each dot an event, coloured by activity.",
    onSelect: fn(),
    onFilterIntent: fn(),
  },
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof DottedChart>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Absolute time on the x axis, rows sorted by case start (the defaults). */
export const Absolute: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(new RegExp(`^${rows.length} cases and`)),
    ).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-slot="canvas-layer-surface"]')).not.toBeNull();
  },
};

/** Every case starts at zero — compare case shapes, not calendar dates. */
export const RelativeToStart: Story = {
  args: { x: "relative" },
};

/** Shortest cases on top; the long tail collects at the bottom. */
export const SortByDuration: Story = {
  args: { sort: "duration" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const sorted = computeDots(log, { sort: "duration" }).rows;
    const cursor = await canvas.findByRole("button", { name: /dotted chart/i });
    cursor.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-slot="canvas-layer-cursor-status"]'),
      ).toHaveTextContent(`Case ${sorted[2]!.caseId},`),
    );
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(args.onSelect).toHaveBeenCalledWith([sorted[2]!.caseId]));
    await expect(await canvas.findByText("1 case selected")).toBeInTheDocument();
  },
};

/** Colour by who executed each event; the same colour budget as activities. */
export const ColorByResource: Story = {
  args: { color: "resource", title: "Work by resource over time" },
};

/** Ten cases selected — everything else dims, and a text count states the selection. */
export const WithSelection: Story = {
  render: (args) => (
    <Stateful {...args} initialSelected={rows.slice(0, 10).map((row) => row.caseId)} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("10 cases selected")).toBeInTheDocument();
  },
};

/** Click a dot to select its case. */
export const ClickToSelect: Story = {
  args: { log: tinyLog, colorScale: undefined, title: "Three orders", height: 240 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("button", { name: /dotted chart/i });
    const surface = canvasElement.querySelector(
      '[data-slot="canvas-layer-surface"]',
    ) as HTMLCanvasElement;
    const rect = surface.getBoundingClientRect();
    // order-1's first event is the earliest in the log: the left inset, top row centre.
    const inset = 6;
    const rowHeight = (rect.height - 2 * inset) / 3;
    await userEvent.pointer([
      {
        keys: "[MouseLeft]",
        target: surface,
        coords: { clientX: rect.left + inset, clientY: rect.top + inset + rowHeight / 2 },
      },
    ]);
    await waitFor(() => expect(args.onSelect).toHaveBeenCalledWith(["order-1"]));
    await expect(await canvas.findByText("1 case selected")).toBeInTheDocument();
  },
};

/** The accessible twin: every case as a table row. */
export const TableView: Story = {
  args: { log: tinyLog, colorScale: undefined, tableView: true, title: "Three orders" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = await canvas.findByRole("table");
    await expect(within(table).getAllByRole("row")).toHaveLength(4);
    await expect(within(table).getByRole("cell", { name: "order-3" })).toBeInTheDocument();
  },
};

/** No log yet — the frame’s skeleton. */
export const Loading: Story = {
  args: { loading: true, log: { events: [] } },
};

/** The filters left no cases. */
export const Empty: Story = {
  args: { log: { events: [] } },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("No events")).toBeInTheDocument();
  },
};
