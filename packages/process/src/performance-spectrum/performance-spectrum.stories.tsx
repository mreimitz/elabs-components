import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, fn, userEvent, waitFor } from "storybook/test";
import { discoverGraph } from "../core/discover-graph";
import { extractVariants } from "../core/extract-variants";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import { segmentKey } from "../core/segments";
import { PerformanceSpectrum } from "./performance-spectrum";

const log = generateSyntheticLog({ cases: 400, seed: 42 });
const graph = discoverGraph(log);
const [topVariant] = extractVariants(log);
const busiest = graph.transitions[0]!;

const meta = {
  title: "Process/PerformanceSpectrum",
  component: PerformanceSpectrum,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "ProM’s performance spectrum (§4 R15): one row per segment, one line per case from " +
          "the moment it left `from` (row top) to the moment it reached `to` (row bottom), on a " +
          "shared time axis. Steep lines are fast, parallel lines are FIFO, crossings overtake, " +
          "and bundles converging on an instant are batches. Lines paint on the charts " +
          "`CanvasLayer`; colour is the per-segment duration quartile and is redundant with " +
          "the line’s own slope. Drag across the time axis to emit a `cases` filter intent.",
      },
    },
  },
  args: { log },
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PerformanceSpectrum>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The busiest segments of the log, one line per occurrence. Brush the axis to filter. */
export const TopSegments: Story = {
  args: { order: "frequency", segmentLimit: 6, onFilterIntent: fn() },
  play: async ({ args, canvas }) => {
    const axis = canvas.getByRole("group", { name: "Time range" });
    const rect = axis.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    fireEvent.pointerDown(axis, {
      pointerId: 1,
      clientX: rect.left + rect.width * 0.2,
      clientY: y,
    });
    fireEvent.pointerMove(axis, {
      pointerId: 1,
      clientX: rect.left + rect.width * 0.4,
      clientY: y,
    });
    fireEvent.pointerUp(axis, { pointerId: 1, clientX: rect.left + rect.width * 0.5, clientY: y });
    await waitFor(() => expect(args.onFilterIntent).toHaveBeenCalledTimes(1));
    const [intent] = (args.onFilterIntent as ReturnType<typeof fn>).mock.calls[0] as [
      { kind: string; ids: string[] },
    ];
    await expect(intent.kind).toBe("cases");
    await expect(intent.ids.length).toBeGreaterThan(0);
  },
};

/** The rows follow the most frequent variant's path, in order. Keyboard: Tab row by row. */
export const VariantPath: Story = {
  args: { order: { variantId: topVariant!.id }, onCaseSelect: fn() },
  play: async ({ args, canvas }) => {
    const rows = canvas.getAllByRole("button", { name: /→/ });
    await expect(rows.length).toBeGreaterThan(1);
    rows[0]!.focus();
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(args.onCaseSelect).toHaveBeenCalledTimes(1));
    await userEvent.tab();
    await expect(rows[1]).toHaveFocus();
  },
};

/** One bar per day per segment — height is cases entering, fill the median quartile. */
export const Aggregated: Story = {
  args: { mode: "aggregated", segmentLimit: 6, binSize: 86_400_000 },
};

/** The selected transition's row carries a rail and says “selected” to assistive tech. */
export const WithSelection: Story = {
  args: {
    segmentLimit: 6,
    selection: { kind: "transition", id: segmentKey(busiest.source, busiest.target) },
    onFilterIntent: fn(),
  },
  play: async ({ args, canvas }) => {
    await expect(
      canvas.getByRole("group", { name: `${busiest.source} → ${busiest.target}, selected` }),
    ).toBeInTheDocument();
    // Keyboard brush: jump to the end, extend back with Shift+PageDown, commit with Enter.
    const axis = canvas.getByRole("group", { name: "Time range" });
    axis.focus();
    await userEvent.keyboard("{End}{Shift>}{PageDown}{PageDown}{/Shift}{Enter}");
    await waitFor(() => expect(args.onFilterIntent).toHaveBeenCalledTimes(1));
  },
};

/** The accessible table twin: cases, median and p90 duration per segment. */
export const TableView: Story = {
  args: { segmentLimit: 6, tableView: true },
  play: async ({ canvas }) => {
    const table = canvas.getByRole("table");
    await expect(table).toBeInTheDocument();
    await expect(canvas.getAllByRole("row")).toHaveLength(7);
  },
};

/** Data not ready yet. */
export const Loading: Story = {
  args: { loading: true },
};

/** The chosen segments never occur in the log. */
export const Empty: Story = {
  args: { order: [{ from: "Nowhere", to: "Never" }] },
};
