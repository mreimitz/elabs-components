import type { Meta, StoryObj } from "@storybook/react-vite";
import { LiveBlotter } from "@/components/grid-live-blotter-01/live-blotter";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/Data Grids/Live Blotter",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "A book that re-prices in place.",
      description: {
        component:
          "18 equity positions re-price on a feed; `flashChanges` flashes only the cells that moved, the trend column is an in-cell sparkline over the last ten prints, and the totals row keeps market value and P&L summed. The feed can be paused and starts paused under reduced motion.\n\nCopy-own it: `npx shadcn add grid-live-blotter-01` (pulls `grid-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof LiveBlotter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <LiveBlotter /> };

/** Paused on load — the state a screenshot or a reduced-motion reader sees. */
export const Paused: Story = { render: () => <LiveBlotter defaultPaused /> };
