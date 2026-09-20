import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import AgentStudioPage from "@/components/agent-studio-page/agent-studio-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: AgentStudioPage,
  title: "Patterns/Templates/AI Products/Agent Studio",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For agent builders, automation platforms and internal AI teams",
      description: {
        component:
          "Where a business designs, equips and watches its agents, as one product. The workspace shell’s navigation swaps the view in place: every design with how it ran this week; the `agent-designer-01` block flush in the shell; the skill library and the MCP servers, with “used by” derived from the designs rather than kept as a second list; and the runs — a run opens in the dock with its steps, a paused one says who it is waiting for, and a failed one opens its full trace (`agent-trace-waterfall-01`).\n\nCopy-own it: `npx shadcn add agent-studio-page`.",
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
} satisfies Meta<typeof AgentStudioPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every design, with how it ran this week. */
export const Default: Story = {};

/** The designer, flush in the shell, on the support design. */
export const Designer: Story = { args: { defaultView: "designer" } };

/** The designer on the four-agent lead qualification design. */
export const DesignerMultiAgent: Story = {
  args: { defaultView: "designer", defaultDesignId: "leads" },
};

/** The skill library, with which designs use each skill. */
export const Skills: Story = { args: { defaultView: "skills" } };

/** The MCP servers: connection state, tools, who can write, and which designs depend on each. */
export const McpServers: Story = { args: { defaultView: "servers" } };

/** The runs. Open one for its steps; the failed one leads to its full trace. */
export const Runs: Story = { args: { defaultView: "runs" } };
