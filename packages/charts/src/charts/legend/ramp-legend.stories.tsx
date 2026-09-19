import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { RampLegend } from "./ramp-legend";

const meta = {
  title: "Charts/RampLegend",
  component: RampLegend,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          'The colour-scale key every ramp consumer shares: `HeatmapChart`, `TreemapChart palette="sequential"` and a choropleth. Continuous or stepped, sequential or diverging, with a marker that moves to a hovered value.',
      },
    },
  },
  decorators: [(Story) => <div className="w-full max-w-sm">{<Story />}</div>],
} satisfies Meta<typeof RampLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Stepped: Story = {
  args: {
    scale: { type: "stepped", domain: [0, 100], steps: 5, labels: "ranges" },
  },
};

export const Continuous: Story = {
  args: {
    scale: { type: "continuous", domain: [0, 42] },
  },
};

export const Diverging: Story = {
  args: {
    scale: { type: "stepped", domain: [-40, 40], steps: 5, labels: "ranges" },
    tone: "diverging",
  },
};

export const CustomLabels: Story = {
  args: {
    scale: {
      type: "stepped",
      domain: [0, 3],
      steps: 4,
      labels: "custom",
      custom: ["Low", "Medium", "High", "Critical"],
    },
  },
};

export const Vertical: Story = {
  args: {
    scale: { type: "continuous", domain: [0, 100] },
    orientation: "vertical",
  },
};

/** The marker that tracks a hovered cell/region's value along the ramp. */
export const HoverMarker: Story = {
  render: (args) => {
    function Demo() {
      const [hover, setHover] = useState<number | null>(35);
      return (
        <div className="flex flex-col gap-3">
          <RampLegend {...args} hover={hover} />
          <input
            aria-label="Hovered value"
            max={100}
            min={0}
            onChange={(event) => setHover(Number(event.target.value))}
            type="range"
            value={hover ?? 0}
          />
        </div>
      );
    }
    return <Demo />;
  },
  args: {
    scale: { type: "continuous", domain: [0, 100] },
  },
};
