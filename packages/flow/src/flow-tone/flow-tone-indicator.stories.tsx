import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { FlowToneIndicator } from "./flow-tone-indicator";

const meta = {
  title: "Flow/FlowToneIndicator",
  component: FlowToneIndicator,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof FlowToneIndicator>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A status tone draws its glyph and names it for assistive technology. */
export const Default: Story = {
  args: { tone: "success" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Success")).toHaveClass("sr-only");
  },
};

/** Every tone. A neutral tone with no emphasis renders nothing — there is nothing to say. */
export const Tones: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <FlowToneIndicator tone="neutral" emphasis="featured" />
      <FlowToneIndicator tone="info" />
      <FlowToneIndicator tone="success" />
      <FlowToneIndicator tone="warning" />
      <FlowToneIndicator tone="destructive" />
    </div>
  ),
};

/** The featured star, alone and next to a status glyph. */
export const Featured: Story = {
  args: { tone: "warning", emphasis: "featured" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Featured, Warning")).toHaveClass("sr-only");
  },
};
