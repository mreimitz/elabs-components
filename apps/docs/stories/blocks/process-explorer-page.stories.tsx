import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProcessExplorerPage } from "@/components/process-explorer-page/process-explorer-page";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ProcessExplorerPage,
  title: "Patterns/Blocks/Process and Flow/Process Explorer",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "Where does the process really go, and where does it wait?",
      description: {
        component:
          "A map-first process-mining workspace. The six KPIs are one ribbon and every control lives in a toolbar, so the height of the screen belongs to the process map and nothing floats over it. Beside the map: statistical insights (throughput distribution against the SLA, the slowest hand-overs, the weekly trend, box and violin plots by region and channel), the variants as colour strips, the selected element with the distribution behind its median, and deviations from the reference model. A dock holds the dotted chart, the performance spectrum, the workload heatmap and the case table; Replay animates every order as a token. One `useProcessExplorer` instance drives every view, so the last interaction wins everywhere.\n\nCopy-own it: `npx shadcn add process-explorer-page`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ProcessExplorerPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A quarter of order to cash: select an activity, a hand-over, a variant or a deviation and every view follows. */
export const Default: Story = {
  render: () => (
    <div className="h-svh">
      <ProcessExplorerPage />
    </div>
  ),
};
