import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { VerdictSideBySide } from "@/components/verdict-side-by-side-01/verdict-side-by-side";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: VerdictSideBySide,
  title: "Patterns/Blocks/Agent Ops/Keep This, Cancel That (Verdict Side By Side)",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A keep-vs-cancel verdict side by side: two cards on the success/destructive washes with annual cost, a segmented seat-utilisation meter and the deciding facts; “If you cancel” as consequence stats; “How the copilot knows” as a numbered evidence list; and the refusal — a person signs.\n\nCopy-own it: `npx shadcn add verdict-side-by-side-01` (pulls `agent-ops-parts`).",
      },
    },
  },
  args: { onDecide: fn() },
  tags: ["autodocs"],
} satisfies Meta<typeof VerdictSideBySide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Narrow: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <VerdictSideBySide {...args} />
    </div>
  ),
};
