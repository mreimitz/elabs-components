import type { Meta, StoryObj } from "@storybook/react-vite";

import { ChatGreeting } from "./chat-greeting";
import { Composer } from "./composer";

const SUGGESTIONS = ["Summary", "Code", "Design", "Research"];

const meta = {
  title: "AI/ChatGreeting",
  component: ChatGreeting,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The centered first-run greeting for an empty chat/composer scene — a display-scale headline with an accent phrase and an optional soft primary glow. Distinct from ConversationEmptyState (a generic 'No messages yet' message panel); pair ChatGreeting with <Composer /> for the standard empty/first-run chat state.",
      },
    },
  },
  args: {
    title: "Good morning, Avery",
    subtitle: "How can I",
    accent: "assist you today?",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ChatGreeting>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The standard greeting with its glow. */
export const Default: Story = {
  render: (args) => (
    <div className="mx-auto max-w-2xl bg-background p-10">
      <ChatGreeting {...args} />
    </div>
  ),
};

/** Dense/embedded use — no glow behind the headline. */
export const NoOrb: Story = {
  args: { orb: false },
  render: (args) => (
    <div className="mx-auto max-w-2xl bg-background p-10">
      <ChatGreeting {...args} />
    </div>
  ),
};

/** A long name and a two-line accent phrase — `text-balance` keeps the headline readable. */
export const LongContent: Story = {
  args: {
    title: "Good afternoon, Alexandra Christodoulopoulos",
    subtitle: "What would you like help with",
    accent: "today across your reports, dashboards, and data models?",
  },
  render: (args) => (
    <div className="mx-auto max-w-2xl bg-background p-10">
      <ChatGreeting {...args} />
    </div>
  ),
};

/** `accent` alone, with no `subtitle` line — the second line must not be dropped. */
export const AccentOnly: Story = {
  args: { title: "Hi Avery", subtitle: undefined, accent: "what are we building today?" },
  render: (args) => (
    <div className="mx-auto max-w-2xl bg-background p-10">
      <ChatGreeting {...args} />
    </div>
  ),
};

/** A route that already owns the page's `<h1>` — pass `level={2}` to keep a single, hierarchical outline. */
export const HeadingLevel2: Story = {
  args: { level: 2 },
  render: (args) => (
    <div className="mx-auto max-w-2xl bg-background p-10">
      <h1 className="sr-only">Assistant</h1>
      <ChatGreeting {...args} />
    </div>
  ),
};

/** The real first-run chat state: greeting above the standard Composer. */
export const WithComposer: Story = {
  parameters: { layout: "fullscreen" },
  render: (args) => (
    <div className="grid min-h-[28rem] place-items-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-2xl">
        <ChatGreeting {...args} />
        <Composer onSubmit={() => undefined} suggestions={SUGGESTIONS} />
      </div>
    </div>
  ),
};
