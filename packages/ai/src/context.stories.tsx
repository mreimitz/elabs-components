import type { Meta, StoryObj } from "@storybook/react-vite";
import { Context, ContextTrigger } from "./context";
const meta = {
  title: "AI/Context",
  component: Context,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Context>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Context usedTokens={2400} maxTokens={8000}>
      <ContextTrigger />
    </Context>
  ),
};
