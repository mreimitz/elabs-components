import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { Legend } from "./legend";

const meta = {
  title: "Flow/Legend",
  component: Legend,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof Legend>;
export default meta;
type Story = StoryObj<typeof meta>;

// ── Categorical (variant omitted — unchanged since before "scale" existed) ──

/** Default legend with a title and token-based color references. */
export const Default: Story = {
  args: {
    title: "Node types",
    items: [
      { label: "Source", color: "var(--primary)" },
      { label: "Transform", color: "var(--muted-foreground)" },
      { label: "Output", color: "var(--success)" },
    ],
  },
};

/** Legend without a title — items only. */
export const NoTitle: Story = {
  args: {
    items: [
      { label: "Source", color: "var(--primary)" },
      { label: "Transform", color: "var(--muted-foreground)" },
      { label: "Output", color: "var(--success)" },
    ],
  },
};

/** Richer set of items representing a full pipeline. */
export const FullPipeline: Story = {
  args: {
    title: "Pipeline stages",
    items: [
      { label: "Source", color: "var(--primary)" },
      { label: "Transform", color: "var(--muted-foreground)" },
      { label: "Validate", color: "var(--warning)" },
      { label: "Output", color: "var(--success)" },
      { label: "Error", color: "var(--destructive)" },
    ],
  },
};

/** Single item. */
export const SingleItem: Story = {
  args: {
    title: "Key",
    items: [{ label: "Active node", color: "var(--primary)" }],
  },
};

// ── Continuous scale (`variant="scale"`) ─────────────────────────────────────

/**
 * Width ramp, default `ticks="minmax"` — min/max sample strokes drawn at the
 * exact widths `computeEdgeWeightScale` (RM-043) would assign those weights,
 * so the legend can never drift from a real flow's weighted edges.
 */
export const ScaleWidth: Story = {
  args: {
    variant: "scale",
    kind: "width",
    domain: [2, 48],
  },
  play: async ({ canvas }) => {
    const group = await canvas.findByRole("group", {
      name: "Edge width scale, 2 to 48, minimum to maximum",
    });
    await waitFor(async () => {
      expect(await canvas.findByText("2")).toBeInTheDocument();
      expect(await canvas.findByText("48")).toBeInTheDocument();
    });

    // One tab stop for the whole reading key, not one per tick.
    group.focus();
    await expect(group).toHaveFocus();
  },
};

/** `ticks="minmedmax"` adds the domain midpoint as a third sample stroke. */
export const ScaleWidthMinMedMax: Story = {
  args: {
    variant: "scale",
    kind: "width",
    domain: [2, 48],
    ticks: "minmedmax",
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      expect(await canvas.findByText("2")).toBeInTheDocument();
      expect(await canvas.findByText("25")).toBeInTheDocument();
      expect(await canvas.findByText("48")).toBeInTheDocument();
    });
  },
};

/**
 * Colour ramp — always a fixed 5-stop gradient built from
 * `--flow-edge-weak`/`--flow-edge-strong`, labelled at every stop via
 * `format`. Colour alone never carries the ordering (WCAG 1.4.1); the five
 * numbered ticks are the required second channel.
 */
export const ScaleColor: Story = {
  args: {
    variant: "scale",
    kind: "color",
    domain: [0, 100],
    format: (value: number) => `${value}%`,
  },
  play: async ({ canvas }) => {
    await canvas.findByRole("group", {
      name: "Edge color scale, 0% to 100%, minimum to maximum",
    });
    await waitFor(() => {
      expect(canvas.getByText("0%")).toBeInTheDocument();
      expect(canvas.getByText("25%")).toBeInTheDocument();
      expect(canvas.getByText("50%")).toBeInTheDocument();
      expect(canvas.getByText("75%")).toBeInTheDocument();
      expect(canvas.getByText("100%")).toBeInTheDocument();
    });
  },
};

/**
 * Zero-width domain (`min === max`) — every sample collapses onto one value.
 * Must render without crashing and without a duplicate React key warning.
 */
export const ScaleWidthZeroDomain: Story = {
  args: {
    variant: "scale",
    kind: "width",
    domain: [10, 10],
    ticks: "minmedmax",
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      expect(await canvas.findAllByText("10")).toHaveLength(3);
    });
  },
};

/** Domain spanning several orders of magnitude. */
export const ScaleColorWideRange: Story = {
  args: {
    variant: "scale",
    kind: "color",
    domain: [1, 1_000_000],
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      expect(await canvas.findByText("1")).toBeInTheDocument();
      expect(await canvas.findByText("1,000,000")).toBeInTheDocument();
    });
  },
};

/** A verbose custom `format` must truncate rather than break the layout. */
export const ScaleWidthLongLabels: Story = {
  args: {
    variant: "scale",
    kind: "width",
    domain: [2, 48],
    ticks: "minmedmax",
    format: (value: number) => `${value.toFixed(2)} transactions processed per hour on average`,
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      expect(
        await canvas.findByText("2.00 transactions processed per hour on average"),
      ).toBeInTheDocument();
    });
  },
};
