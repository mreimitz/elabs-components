import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageFeedback } from "./message-feedback";
import { MessageActions } from "./message";

const meta = {
  title: "AI/MessageFeedback",
  component: MessageFeedback,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof MessageFeedback>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Default — click a thumb to submit; both controls then disable. */
export const Default: Story = {
  args: { onSubmit: (f) => console.info("feedback", f) },
};

/** Submitted (positive) — the chosen thumb stays prominent, controls inert. */
export const SubmittedPositive: Story = {
  args: { value: "positive" },
};

/** Submitted (negative). */
export const SubmittedNegative: Story = {
  args: { value: "negative" },
};

/** Compact — tighter spacing/size for a message action toolbar. */
export const Compact: Story = {
  render: () => (
    <MessageActions>
      <MessageFeedback compact onSubmit={(f) => console.info("feedback", f)} />
    </MessageActions>
  ),
};

/** Disabled — e.g. while the message is still streaming. */
export const Disabled: Story = {
  args: { disabled: true },
};

/** Dark theme. */
export const DarkTheme: Story = {
  args: { value: "positive" },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="rounded-lg bg-background p-6 text-foreground">
        <Story />
      </div>
    ),
  ],
};
