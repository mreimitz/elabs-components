import type { Meta, StoryObj } from "@storybook/react-vite";
import { SizeLegend } from "./size-legend";

const meta = {
  title: "Charts/SizeLegend",
  component: SizeLegend,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The radius key for an area encoding (a scatter `sizeKey`, a bubble cluster): three sqrt-scaled sample circles, matching every area mark's `areaRadius()` honesty rule.",
      },
    },
  },
  decorators: [(Story) => <div className="w-full max-w-sm">{<Story />}</div>],
} satisfies Meta<typeof SizeLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { domain: [0, 100] },
};

export const CurrencyValues: Story = {
  args: { domain: [0, 2_500_000], valueFormat: "currency", currency: "USD" },
};

export const TwoSteps: Story = {
  args: { domain: [0, 40], steps: 2 },
};
