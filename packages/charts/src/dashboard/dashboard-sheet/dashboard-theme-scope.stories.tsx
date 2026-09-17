import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ThemeProvider, defineTheme } from "@elabs-ai/components-tokens";

import type { DashboardSpec } from "../core/spec";
import { DashboardProvider, DashboardSheet } from "../dashboard-sheet";
import { textTileKind } from "../tiles/text-tile";
import { DashboardThemeScope } from "./dashboard-theme-scope";

/** A registry of two custom light/dark themes standing in for a host's OWN brand family —
 * `dashboard/` never imports a real community theme (D4, `.claude/rules/dashboard.md`). */
const DEMO_THEMES = [
  defineTheme({ value: "demo-light", label: "Demo Light", dark: false, family: "demo" }),
  defineTheme({ value: "demo-dark", label: "Demo Dark", dark: true, family: "demo" }),
];

const SPEC: DashboardSpec = {
  version: 1,
  id: "theme-scope-demo",
  grid: { mode: "fit", columns: 12, rows: 6 },
  tiles: [
    {
      id: "note-1",
      kind: "text",
      layout: { x: 0, y: 0, w: 12, h: 6 },
      content: { body: "Sheet content" },
    },
  ],
};

const meta = {
  title: "Dashboard/Chrome/DashboardThemeScope",
  component: DashboardThemeScope,
  parameters: { layout: "padded" },
  // `DashboardThemeScope` reads the page's active theme (`useTheme()`) to fall back on when
  // `theme.family`/`mode` can't resolve — a real `<ThemeProvider>` ancestor, same as any app
  // mounting it (Storybook's own preview only mimics the `data-theme` attribute, not the
  // context — `theme-switcher.stories.tsx` is the existing precedent for this decorator).
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof DashboardThemeScope>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No `theme` on the spec: the sheet renders in whatever theme the page is already using. */
export const Inherited: Story = {
  render: () => (
    <DashboardThemeScope>
      <div className="h-64">
        <DashboardProvider spec={SPEC} tiles={[textTileKind]}>
          <DashboardSheet chrome={false} />
        </DashboardProvider>
      </div>
    </DashboardThemeScope>
  ),
};

/** `spec.theme = { family: "demo", mode: "dark" }`: the sheet gets the dark member of the
 * `demo` family while the story page around it keeps its own theme — the scoped
 * `data-theme` lands on this component's own root, never on `<html>`. */
export const FamilyOverride: Story = {
  render: () => (
    <DashboardThemeScope theme={{ family: "demo", mode: "dark" }} themes={DEMO_THEMES}>
      <div className="h-64">
        <DashboardProvider spec={SPEC} tiles={[textTileKind]}>
          <DashboardSheet chrome={false} />
        </DashboardProvider>
      </div>
    </DashboardThemeScope>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A tile's body mounts lazily once it intersects (dashboard-sheet.tsx) — `findByText`
    // waits for the real, browser-native `IntersectionObserver` callback.
    await expect(await canvas.findByText("Sheet content")).toBeInTheDocument();
    const scope = canvasElement.querySelector('[data-slot="dashboard-theme-scope"]');
    await expect(scope).toHaveAttribute("data-theme", "demo-dark");
    await expect(document.documentElement.getAttribute("data-theme")).not.toBe("demo-dark");
  },
};
