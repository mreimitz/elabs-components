import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import EnergyOperationsPage from "@/components/energy-operations-page/energy-operations-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: EnergyOperationsPage,
  title: "Patterns/Templates/Energy/Energy Operations",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For utilities, industrial energy managers and grid operators",
      description: {
        component:
          "The site desk of a utility that runs the grid connection of eight industrial parks. A headline computed from the fleet (who buys above contract, who is near its capacity band), the sites as a `DataTable` beside a `MapCanvas` whose markers carry status as colour, glyph and text, the `energy-desk-01` block re-reading the SELECTED site's 120 days of meters, and a dock the selection summons — the contract in `Descriptions`, the open alarms with the runbook's response and an Acknowledge that steps the site down, and an analyst conversation (`Conversation`, `Tool`, `Suggestion`, `Composer`) whose answers are computed from the same rows. One selection state is shared by the table, the map, the desk and the dock.\n\nCopy-own it: `npx shadcn add energy-operations-page`.",
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
} satisfies Meta<typeof EnergyOperationsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Select a site, then acknowledge its critical alarm: the row, the dock and the nav badge agree. */
export const SelectAndAcknowledge: Story = {
  args: { blankMap: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: /Open Halden Industrial Park/ }),
    );
    const dock = await canvas.findByTestId("site-dock");
    await expect(within(dock).getByText("ALM-2041 · 16:38")).toBeVisible();
    await expect(
      canvas.getByRole("heading", { name: /Halden Industrial Park — 120 days/ }),
    ).toBeVisible();

    await userEvent.click(within(dock).getAllByRole("button", { name: "Acknowledge" })[0]!);
    await waitFor(() =>
      expect(within(dock).queryByText("ALM-2041 · 16:38")).not.toBeInTheDocument(),
    );
    // Only a minor alarm is left, so the site steps down from alarm to watch.
    await expect(within(dock).getByText("watch")).toBeVisible();
  },
};
