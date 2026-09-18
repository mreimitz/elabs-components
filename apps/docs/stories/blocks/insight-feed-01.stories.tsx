import type { Meta, StoryObj } from "@storybook/react-vite";
import { insights } from "@/components/agent-ops-parts/data/atlas-ops";
import { InsightFeed } from "@/components/insight-feed-01/insight-feed";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Agent Ops/What Changed While You Were Away (Insight Feed)",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The AI-ops briefing: a numbered feed of what the copilot did or noticed — a one-sentence fact, a paragraph of why, evidence chips, a confidence meter and two actions. A conflict item carries no confidence (“No verdict — a person decides”). Beside it, “Needs a person” and “Derivation load”.\n\nCopy-own it: `npx shadcn add insight-feed-01` (pulls `agent-ops-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InsightFeed>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <InsightFeed /> };

/** Feed only — the rail is dropped when there is nothing waiting on a person. */
export const FeedOnly: Story = {
  render: () => <InsightFeed held={[]} items={insights.filter((i) => i.kind !== "conflict")} />,
};

export const Loading: Story = { render: () => <InsightFeed loading /> };

export const Narrow: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <InsightFeed />
    </div>
  ),
};
