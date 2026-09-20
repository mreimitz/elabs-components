import type { Meta, StoryObj } from "@storybook/react-vite";
import { leadScore } from "@/components/agent-ops-parts/data/atlas-ops";
import { ScoreExplanation } from "@/components/score-explanation-01/score-explanation";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Agent Ops/Score Explanation",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Why is the score 91?",
      description: {
        component:
          "A scored decision decomposed into its signals: one row per signal, a signed bar whose length is the contribution in points and whose direction is the sign — ink for positive, the warning rung for negative, each with a signed number. One shared zero-based scale; the footer states what was left out.\n\nCopy-own it: `npx shadcn add score-explanation-01` (pulls `agent-ops-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ScoreExplanation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <ScoreExplanation /> };

/** Only positive signals — the zero line moves to the start and bars use the whole track. */
export const AllPositive: Story = {
  render: () => (
    <ScoreExplanation
      omittedSignals={0}
      score={64}
      signals={leadScore.signals.filter((s) => s.points > 0)}
    />
  ),
};

export const Narrow: Story = {
  render: () => (
    <div className="w-full max-w-xs">
      <ScoreExplanation />
    </div>
  ),
};
