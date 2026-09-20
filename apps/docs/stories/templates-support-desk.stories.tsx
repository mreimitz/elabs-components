import type { Meta, StoryObj } from "@storybook/react-vite";
import SupportDeskPage from "@/components/support-desk-page/support-desk-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: SupportDeskPage,
  title: "Patterns/Templates/Customers/Support Desk",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For support, service and helpdesk products",
      description: {
        component:
          "Queue, conversation, context — the screen a support agent lives in. A three-pane surface inside the workspace shell (`inset=\"flush\"`, laid out by container queries so the context pane stands down before the conversation does); a queue sorted by the promise that breaks first, each row carrying its time left as a `Meter`; a conversation built from the ai package's `Message` parts; a copilot draft grounded in named past tickets that you send or discard — it is never sent for you; and a context pane with the promise, the customer and what solved it before. Sending a reply restarts the ticket's clock and re-sorts the queue.\n\nCopy-own it: `npx shadcn add support-desk-page`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SupportDeskPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
