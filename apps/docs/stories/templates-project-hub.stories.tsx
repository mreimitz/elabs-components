import type { Meta, StoryObj } from "@storybook/react-vite";
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
          "Projects, the issue board, the team's load and the members as one product. The workspace shell's navigation swaps the view in place (`onNavigate`); four registry blocks do the work — `project-cards-01`, `kanban-board-01`, `settings-members-01` and a team-load view built on the same issues; and one dock explains whatever was last opened, a project or an issue, without leaving the view. Every view reads the same issues, so moving a card on the board changes the team's load, the overview and the counts in the navigation.\n\nCopy-own it: `npx shadcn add project-hub-page`.",
      },
    },
  },
  tags: ["autodocs"],
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
