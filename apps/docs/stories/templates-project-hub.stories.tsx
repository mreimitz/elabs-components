import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import ProjectHubPage from "@/components/project-hub-page/project-hub-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ProjectHubPage,
  title: "Patterns/Templates/Product Teams/Project Hub",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For project, issue-tracking and delivery tools",
      description: {
        component:
          "Projects, the issue board, the team's load and the members as one product. The workspace shell's navigation swaps the view in place (`onNavigate`); four registry blocks do the work — `project-cards-01`, `kanban-board-01`, `settings-members-01` and a team-load view built on the same issues, its story-points-per-column `BarChart` carrying a mean-line `analytics` overlay; and one dock explains whatever was last opened, a project or an issue, without leaving the view. Every view reads the same issues, so moving a card on the board changes the team's load, the overview and the counts in the navigation.\n\nCopy-own it: `npx shadcn add project-hub-page`.",
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
} satisfies Meta<typeof ProjectHubPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Opened on the issue board. */
export const Issues: Story = { args: { defaultView: "issues" } };

/** Opened on the team's load. */
export const TeamLoad: Story = { args: { defaultView: "team" } };

/** Opened on the overview. */
export const Overview: Story = { args: { defaultView: "overview" } };
