import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import FinanceClosePage from "@/components/finance-close-page/finance-close-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: FinanceClosePage,
  title: "Patterns/Templates/Finance/Month-End Close",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For controllers and finance teams",
      description: {
        component:
          "A month-end close run in one workspace. The journal-entry `DataGrid` opens grouped by account with sums and a totals row; status and memo are edited in place until an entry is posted (only approved entries can be posted), saved views are versioned `GridState`s, Export to Excel writes exactly the view on screen, and Post approved is a bulk action with Undo. Below it the `grid-cost-tree-01` block runs the re-forecast by cost centre.\n\nCopy-own it: `npx shadcn add finance-close-page` (pulls `workspace-shell`, `grid-parts` and `grid-cost-tree-01`).",
      },
    },
  },
  tags: ["autodocs"],
  // The shell's <ThemeSwitcher /> reads the tokens React context, so the screen
  // needs a real provider (see templates-revenue-ops.stories.tsx).
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof FinanceClosePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
