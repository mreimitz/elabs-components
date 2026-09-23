import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import SecurityOpsPage from "@/components/security-operations-page/security-operations-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: SecurityOpsPage,
  title: "Patterns/Templates/Security/Security Operations",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For security operations teams, incident responders and detection engineers",
      description: {
        component:
          "The triage screen of a security team. A headline computed from the open queue (how many open, how many critical, the oldest), the alerts as a `DataTable` under a `FilterBar` over severity and source, beside a `MapCanvas` that clusters the open alerts on the assets they fire from, and a dock the selection summons — the alert in `Descriptions`, its indicators, the alerts linked by the same user or host, and an analyst conversation (`Conversation`, `Tool`, `Suggestion`, `Composer`) whose first turn enriches the indicators and whose second waits for the approval to isolate the host. Contain and Close as benign move the row, the queue badge and the KPIs together, with an Undo in the toast. Below the queue the `incident-explorer-01` block reads the same sources over ninety days.\n\nCopy-own it: `npx shadcn add security-operations-page`.",
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
} satisfies Meta<typeof SecurityOpsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Triage the critical alert, then contain its host: the dock, the row and the nav badge agree. */
export const TriageAndContain: Story = {
  args: { blankMap: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The Queue nav entry carries the open count as a sidebar badge beside its link.
    const queueCount = () => {
      const link = canvas.getAllByRole("link", { name: "Queue" })[0]!;
      const badge = link
        .closest('[data-slot="sidebar-menu-item"]')
        ?.querySelector('[data-slot="sidebar-menu-badge"]');
      return Number(badge?.textContent);
    };
    await canvas.findAllByRole("link", { name: "Queue" });
    const openBefore = queueCount();
    expect(openBefore).toBeGreaterThan(0);

    await userEvent.click(await canvas.findByRole("button", { name: /Triage ALT-7821/ }));
    const dock = await canvas.findByTestId("triage-dock");
    await expect(within(dock).getByText(/procdump64\.exe/)).toBeVisible();
    await expect(within(dock).getByText("Waiting for your approval")).toBeVisible();

    await userEvent.click(within(dock).getByRole("button", { name: "Contain asset" }));
    await waitFor(() => expect(within(dock).getByText("contained")).toBeVisible());
    await waitFor(() => expect(queueCount()).toBe(openBefore - 1));
  },
};
