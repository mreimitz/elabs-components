import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import A2uiAssistantPage from "@/components/a2ui-assistant-page/a2ui-assistant-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: A2uiAssistantPage,
  title: "Patterns/Templates/AI Products/Generative UI Assistant",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For products where the agent answers with a screen, not a paragraph",
      description: {
        component:
          "An assistant built on A2UI: the agent describes a screen as data, brand-ui validates it against the catalog and renders it with the real components. Five conversations show the range — a refund decision, an analytics answer with charts and a drill-down, an incident form whose fields report as named actions, a streamed release plan with tabs and bullet charts, and a surface the catalog refuses followed by its repair. The inspector shows the JSON on the wire, the actions the host received and the catalog the agent may draw from.\n\nCopy-own it: `npx shadcn add a2ui-assistant-page`.",
      },
    },
  },
  tags: ["autodocs"],
  // The shell's <ThemeSwitcher /> reads the @elabs-ai/components-tokens React context.
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof A2uiAssistantPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** An analytics answer: KPI tiles, two AutoChart figures and a drill-down on click. */
export const AnalyticsAnswer: Story = { args: { defaultScenario: "revenue" } };

/** A form the agent pre-filled; the inspector opens on the actions the host receives. */
export const IncidentForm: Story = {
  args: { defaultScenario: "incident", defaultInspector: "actions" },
};

/** What the catalog refuses — and the repaired surface after the error list goes back. */
export const Guardrail: Story = { args: { defaultScenario: "guardrail" } };

/** The inspector on the catalog: every type the agent may draw, with its events. */
export const Catalog: Story = { args: { defaultScenario: "rollout", defaultInspector: "catalog" } };
