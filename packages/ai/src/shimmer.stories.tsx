import type { Meta, StoryObj } from "@storybook/react-vite";
import { Shimmer } from "./shimmer";
const meta = {
  title: "AI/Shimmer",
  component: Shimmer,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Shimmer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { render: () => <Shimmer>Generating response…</Shimmer> };
