import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Progress } from "./progress";
const meta = {
  title: "Display/Progress",
  component: Progress,
  tags: ["autodocs"],
  argTypes: {
    value: {
      description: "Current progress value (0–100). `null` / undefined = indeterminate.",
      control: "number",
      table: { category: "State" },
    },
    max: {
      description: "Maximum value; defaults to 100.",
      control: "number",
      table: { category: "Behavior" },
    },
    variant: {
      description:
        "Indicator fill tone (#358) — reuses the StatusBadge/Alert vocabulary. Pair a non-default tone with `aria-valuetext` so the state isn't color-only.",
      control: { type: "select" },
      options: ["default", "success", "warning", "destructive"],
      table: { category: "Appearance" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn() on the track.",
      control: "text",
      table: { category: "Appearance" },
    },
    marker: {
      description:
        "Reference point (0–100) rendered as a thin vertical tick — e.g. an “expected by today” pace or a target. Unset renders no tick.",
      control: { type: "number", min: 0, max: 100 },
      table: { category: "Reference" },
    },
    markerLabel: {
      description:
        "What `marker` represents, already localized (e.g. “expected 70% by today”). Appended to the accessible value text unless a caller-supplied `aria-valuetext` is set.",
      control: "text",
      table: { category: "Reference" },
    },
  },
} satisfies Meta<typeof Progress>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { render: () => <Progress value={62} className="w-64" /> };
export const Full: Story = { render: () => <Progress value={100} className="w-64" /> };
export const Empty: Story = { render: () => <Progress value={0} className="w-64" /> };

/**
 * All four tones (#358). Non-text contrast of the indicator fill against the
 * `bg-muted` track (WCAG 1.4.11, ≥3:1), **measured in a real browser** on this
 * story (`getComputedStyle` → canvas readback, 2026-08-02) rather than derived
 * from the token literals:
 *
 * | tone        | light | dark |
 * | ----------- | ----------- | --------- |
 * | default     | 4.09:1      | 7.17:1    |
 * | success     | 5.19:1      | 9.07:1    |
 * | warning     | 4.44:1      | 7.88:1    |
 * | destructive | 4.94:1      | 4.79:1    |
 *
 * All four clear 3:1 in both painted themes. `warning` used to be the hole in
 * this table (1.88:1 in light); it was a token-value gap, not a component
 * one, and #381 fixed it at the token — `--warning` is now a deep amber that
 * clears 3:1 on every content surface.
 *
 * High decoration is deliberately NOT in this table: the decoration dial no
 * longer re-inks controls at all (decoration paints backgrounds and chart
 * fills only), so the indicator fill is the SAME painted token at every
 * decoration level and this measurement holds across the whole dial.
 */
export const Tones: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-3">
      <Progress value={62} variant="default" aria-label="Default tone" />
      <Progress value={62} variant="success" aria-label="Success tone" />
      <Progress value={62} variant="warning" aria-label="Warning tone" />
      <Progress
        value={100}
        variant="destructive"
        aria-label="Destructive tone"
        aria-valuetext="Exceeded — 120 of 100"
      />
    </div>
  ),
  play: async ({ canvas }) => {
    const destructive = canvas.getByRole("progressbar", { name: "Destructive tone" });
    await expect(destructive).toHaveAttribute("aria-valuetext", "Exceeded — 120 of 100");
  },
};

/**
 * A KPI running behind its pace marker (62% done, expected 70% by today) —
 * `markerLabel` composes into `aria-valuetext` alongside the raw value.
 */
export const WithMarker: Story = {
  render: () => (
    <Progress
      aria-label="Quarterly goal"
      className="w-64"
      marker={70}
      markerLabel="expected 70% by today"
      value={62}
    />
  ),
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("progressbar", { name: "Quarterly goal" });
    await expect(bar).toHaveAttribute("aria-valuetext", "62%, expected 70% by today");
  },
};

/** Ahead of pace — the same reference tick, further behind the filled value. */
export const WithMarkerAhead: Story = {
  render: () => (
    <Progress
      aria-label="Quarterly goal"
      className="w-64"
      marker={50}
      markerLabel="expected 50% by today"
      value={78}
    />
  ),
  play: async ({ canvas }) => {
    const bar = canvas.getByRole("progressbar", { name: "Quarterly goal" });
    await expect(bar).toHaveAttribute("aria-valuetext", "78%, expected 50% by today");
  },
};

/** The pace tick renders on every tone variant, not only `default`. */
export const MarkerAllVariants: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-3">
      <Progress
        aria-label="Default tone with marker"
        marker={70}
        markerLabel="expected 70% by today"
        value={62}
        variant="default"
      />
      <Progress
        aria-label="Success tone with marker"
        marker={70}
        markerLabel="expected 70% by today"
        value={62}
        variant="success"
      />
      <Progress
        aria-label="Warning tone with marker"
        marker={70}
        markerLabel="expected 70% by today"
        value={62}
        variant="warning"
      />
      <Progress
        aria-label="Destructive tone with marker"
        marker={70}
        markerLabel="expected 70% by today"
        value={62}
        variant="destructive"
      />
    </div>
  ),
};
