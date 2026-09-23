import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import DeveloperPlatformPage from "@/components/developer-platform-page/developer-platform-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: DeveloperPlatformPage,
  title: "Patterns/Templates/Engineering/Developer Platform",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For platform teams, release managers and the engineers whose run just went red",
      description: {
        component:
          "The delivery control room of a company that ships a storefront, its checkout and the workers behind them. A headline computed from today's runs (how many failed, whether main is green, when production last changed), the four DORA figures as `MetricCard`s computed from 28 days of deploy history, the pipeline as a `CanvasShell` graph whose nodes take the selected run's stage results — tone, glyph and word — beside the run log in a `Terminal`; selecting a stage in the graph narrows the log to it. Today's runs are a `DataTable` under a `FilterBar` over status and service, the platform's trail is the `audit-log-01` block, and a dock the selection summons shows the run in `Descriptions`, the failing check and the change under test as a `DiffEditor`. Re-run failed stage re-queues the run, steps the sidebar badge down and appends an audit entry, with an Undo in the toast.\n\nCopy-own it: `npx shadcn add developer-platform-page`.",
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
} satisfies Meta<typeof DeveloperPlatformPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Open the failed run, read the failing test, re-run the stage: the dock, the log and the nav badge agree. */
export const RerunFailedStage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The Pipelines nav entry carries the failed count as a sidebar badge beside its link.
    const failedCount = () => {
      const link = canvas.getAllByRole("link", { name: "Pipelines" })[0]!;
      const badge = link
        .closest('[data-slot="sidebar-menu-item"]')
        ?.querySelector('[data-slot="sidebar-menu-badge"]');
      return Number(badge?.textContent);
    };
    await canvas.findAllByRole("link", { name: "Pipelines" });
    const failedBefore = failedCount();
    expect(failedBefore).toBeGreaterThan(0);

    await userEvent.click(await canvas.findByRole("button", { name: "Open #4821" }));
    const dock = await canvas.findByTestId("run-dock");
    await expect(within(dock).getByText("Stopped at Unit tests")).toBeVisible();
    await expect(
      within(dock).getByText(/applies the volume discount at exactly 100 units/),
    ).toBeVisible();

    await userEvent.click(within(dock).getByRole("button", { name: "Re-run failed stage" }));
    await waitFor(() => expect(within(dock).getByText("running")).toBeVisible());
    await waitFor(() => expect(failedCount()).toBe(failedBefore - 1));
    // The re-run is on the record.
    await expect(canvas.getByText("Re-ran #4821 from Unit tests")).toBeVisible();
  },
};
