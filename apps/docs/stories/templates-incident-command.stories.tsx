import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import IncidentCommandPage from "@/components/incident-command-page/incident-command-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: IncidentCommandPage,
  title: "Patterns/Templates/Operations/Incident Command",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For reliability, observability and platform teams",
      description: {
        component:
          "One live incident, run from one screen. The header states severity, impact and who is in charge; the impact streams through a `LiveLineChart` and the promise sits on an `AreaChart` as a labelled rule, with an `analytics` mean line for contrast; the blast radius comes from the `infographic-dependency-web-01` block. The runbook drives everything else: running a step prints its output into the terminal package's `Terminal`, ticks the step, moves the progress `Meter` and writes the incident log — and steps only run in order. When the last one passes, the error stream settles, Resolve unlocks, and the header says so.\n\nCopy-own it: `npx shadcn add incident-command-page`.",
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
} satisfies Meta<typeof IncidentCommandPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
