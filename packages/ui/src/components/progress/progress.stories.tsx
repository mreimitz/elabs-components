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
