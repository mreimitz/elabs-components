import type { Meta, StoryObj } from "@storybook/react-vite";
import { Toaster } from "@elabs-ai/components-ui";
import { EventLog } from "@/components/grid-event-log-01/event-log";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Data Grids/Event Log",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Triage 5,000 requests without paging.",
      description: {
        component:
          "A request log that loads 100 events at a time as you scroll (`onLoadMore`), with set filters on level and service, a number filter on duration, Find (Ctrl/⌘+F), saved views stored as versioned `GridState` JSON, and an Excel export of exactly what is on screen (`tableToXlsx`).\n\nCopy-own it: `npx shadcn add grid-event-log-01` (pulls `grid-parts`).",
      },
    },
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta<typeof EventLog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <EventLog /> };
