import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bell, Cable, Sparkles } from "lucide-react";
import { MarketingProcess } from "@/components/marketing-process-01/marketing-process";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingProcess,
  title: "Patterns/Blocks/Marketing/Process",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "How does it work, step by step?",
      description: {
        component:
          "How it works in four numbered steps along a rail that fades out at both ends. Each step has a glyph, a title, a sentence or two and a chip naming what the visitor will see on screen. A row across when the container is wide, a column when it is not.\n\nCopy-own it: `npx shadcn add marketing-process-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingProcess>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Three steps for a simpler product. */
export const ThreeSteps: Story = {
  args: {
    title: "Live before lunch",
    description: "Three steps from a spreadsheet to a planned route.",
    steps: [
      {
        id: "import",
        icon: <Cable aria-hidden="true" />,
        title: "Import the stops",
        body: "Drop in the spreadsheet you already have. Addresses are checked and fixed as they come in.",
        sees: "A map of every stop",
      },
      {
        id: "plan",
        icon: <Sparkles aria-hidden="true" />,
        title: "Plan the routes",
        body: "Relay assigns stops to trucks around time windows, driver hours and vehicle size.",
        sees: "Routes per driver",
      },
      {
        id: "drive",
        icon: <Bell aria-hidden="true" />,
        title: "Send them to the yard",
        body: "Drivers get the plan in the app. When a truck runs late, the plan re-plans and tells you.",
        sees: "Live progress per truck",
      },
    ],
  },
};
