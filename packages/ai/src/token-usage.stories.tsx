import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenUsage, TokenUsageTrigger } from "./token-usage";
const meta = {
  title: "AI/TokenUsage",
  component: TokenUsage,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The context-WINDOW usage ring: a compact `usedTokens` / `maxTokens` dial that opens a hover card with the input/output token split and, when `modelId` is known, an estimated cost. It was called `Context` until it was renamed for exactly this reason — the chat workspace’s right rail is `AI/ContextPanel`, a different component with a confusingly similar old name. See [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs).",
      },
    },
  },
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
