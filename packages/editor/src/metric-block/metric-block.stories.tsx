import type { Meta, StoryObj } from "@storybook/react-vite";
import { MetricBlock } from "./metric-block";

const meta = {
  title: "Editor/MetricBlock",
  component: MetricBlock,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Compact KPI tile (label · value · description · optional delta). The branded " +
          "target for the `::metric` directive. Thin alias for `@qlik-coe-emea/qlabs-components-ui` MetricCard " +
          "(see ADR 0012).",
      },
    },
  },
} satisfies Meta<typeof MetricBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Migration scope",
    value: "1,245",
    description: "frozen report candidates",
    delta: "+12%",
    deltaDirection: "up",
  },
};

export const NoDelta: Story = {
  args: {
    label: "Open gaps",
    value: "2",
    description: "in @qlik-coe-emea/qlabs-components-data + @qlik-coe-emea/qlabs-components-icons",
  },
};
