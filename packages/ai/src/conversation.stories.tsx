import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Conversation, ConversationContent, ConversationEmptyState } from "./conversation";
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

/**
 * **Layout lock (#72).** With zero messages, `ConversationEmptyState` must render
 * vertically centred in the conversation canvas — not pinned to the top with a
 * gap of empty space below (the original bug: `ConversationContent` never grew
 * past its shrink-wrapped content size, so the canvas's extra height sat unused
 * below it).
 *
 * This can only be verified with real CSS layout (`getBoundingClientRect`), never
 * a class-string assertion — jsdom performs no layout, and asserting a class name
 * would have passed on the buggy `size-full` markup verbatim (`size-full` was
 * always present; it just had nothing to fill). Per
 * `.claude/rules/component-api.md` § "Regression locks with observable side
 * effects", this runs in the ordinary full-suite invocation, not only isolated.
 *
 * We deliberately measure `ConversationEmptyState`'s OWN rendered box against the
 * outer canvas (`role="log"`'s parent), not against `ConversationContent`'s box —
 * the empty state is `size-full` inside `ConversationContent`, so comparing it to
 * its immediate parent is tautological (it always exactly fills it, bug or not).
 * Comparing against the fixed-height canvas is what actually distinguishes
 * "pinned to the top of a tall canvas" from "filling — and centred within — the
 * canvas".
 */
export const EmptyStateCentering: Story = {
  render: () => (
    <div className="flex h-72 flex-col rounded-lg border">
      <Conversation>
        <ConversationContent>
          <ConversationEmptyState
            title="Start the conversation"
            description="Ask anything to begin."
          />
        </ConversationContent>
      </Conversation>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const log = within(canvasElement).getByRole("log");
    const canvas = log.parentElement as HTMLElement;
    const heading = within(canvasElement).getByRole("heading", { name: "Start the conversation" });
    // heading (h3) -> the "space-y-1" title/description group -> ConversationEmptyState's own root div.
    const emptyState = heading.parentElement!.parentElement as HTMLElement;

    const canvasRect = canvas.getBoundingClientRect();
    const emptyRect = emptyState.getBoundingClientRect();

    const gapAbove = emptyRect.top - canvasRect.top;
    const gapBelow = canvasRect.bottom - emptyRect.bottom;

    await expect(Math.abs(gapAbove - gapBelow)).toBeLessThan(8);
  },
};
