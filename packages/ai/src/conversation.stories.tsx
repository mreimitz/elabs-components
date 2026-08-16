import type { Meta, StoryObj } from "@storybook/react-vite";
import { Conversation, ConversationContent } from "./conversation";
import { Message, MessageContent } from "./message";
const meta = {
  title: "AI/Conversation",
  component: Conversation,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Conversation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <div className="flex h-72 flex-col rounded-lg border">
      <Conversation>
        <ConversationContent>
          <Message from="user">
            <MessageContent>Hello</MessageContent>
          </Message>
          <Message from="assistant">
            <MessageContent>Hi! How can I help with your deploys today?</MessageContent>
          </Message>
        </ConversationContent>
      </Conversation>
    </div>
  ),
};
