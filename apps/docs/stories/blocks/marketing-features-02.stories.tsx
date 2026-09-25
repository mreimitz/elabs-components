import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingFeatureShowcase } from "@/components/marketing-features-02/marketing-feature-showcase";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingFeatureShowcase,
  title: "Patterns/Blocks/Marketing/Feature showcase",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "How do I show a feature rather than describe it?",
      description: {
        component:
          "Three feature rows in a zig-zag: copy on one side, the feature itself on the other, sides swapping row by row. The visuals are the library’s own table with status badges, a run timeline and a card of sparklines — the product, not a picture of it. Rows stack below the 2xl container width.\n\nCopy-own it: `npx shadcn add marketing-features-02`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingFeatureShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One row only — a feature page that leads with a single proof. */
export const SingleRow: Story = {
  args: {
    title: "Automation you can read back",
    sections: [
      {
        id: "steps",
        eyebrow: "A record you can read",
        title: "Every decision the workflow made, in plain words",
        body: "Open a run and read what happened as a timeline: what came in, what was checked, which branch was taken, and where a person was asked.",
        bullets: [
          "Inputs and outputs per step",
          "Approvals in Slack, Teams or email",
          "Timestamps to the second",
        ],
        link: { label: "Read a full run record", href: "#record" },
        visual: (
          <div className="rounded-lg border border-border bg-card p-6 text-body text-muted-foreground">
            Your own visual goes here.
          </div>
        ),
        visualLabel: "Placeholder visual",
      },
    ],
  },
};
