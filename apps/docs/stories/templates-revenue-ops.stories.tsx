import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import RevenueOpsPage from "@/components/revenue-ops-page/revenue-ops-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: RevenueOpsPage,
  title: "Patterns/Templates/Analytics/Revenue Operations",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For revenue, finance and BI teams",
      description: {
        component:
          "A whole analytics workspace rather than a dashboard in a box. The workspace shell carries real navigation and a summoned analyst; the page header's controls all do something — the period re-slices every chart, the region filters the pipeline; the body is the `command-center-revenue-01` block; and the pipeline `DataTable` rows carry their own evidence: a win-probability `Meter`, an eight-week activity `Sparkline`, a computed Stalled flag, and row selection that feeds a summary and a bulk action.\n\nCopy-own it: `npx shadcn add revenue-ops-page` (pulls `workspace-shell` and `command-center-revenue-01`).",
      },
    },
  },
  tags: ["autodocs"],
  // The shell's <ThemeSwitcher /> reads the @elabs-ai/components-tokens React
  // context, so the screen needs a real provider — the global preview decorator
  // only writes the `data-theme` attribute. In a consuming app this sits at the
  // root. It mounts DEEPER than the preview's own theme boundary, so a
  // `STORYBOOK_THEME=<slug>` sweep still wins (child effects flush first).
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof RevenueOpsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
