import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenUsage, TokenUsageTrigger } from "./token-usage";
const meta = {
  title: "AI/TokenUsage",
  component: TokenUsage,
  parameters: { layout: "padded" },
} satisfies Meta<typeof TokenUsage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <TokenUsage usedTokens={2400} maxTokens={8000}>
      <TokenUsageTrigger />
    </TokenUsage>
  ),
};
