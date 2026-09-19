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
      description: {
        component:
          "The process-explorer screen: a KPI strip, a filter bar fed by what you select, a process map with an accessible table twin, a variant rail that filters the map, and a case table that opens one case's timeline. One `useProcessExplorer` instance drives every view, so the last interaction wins everywhere.\n\nCopy-own it: `npx shadcn add process-explorer-page`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ProcessExplorerPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The sample order-to-cash log: select an activity, a transition or a variant and every view follows. */
export const Default: Story = {};
