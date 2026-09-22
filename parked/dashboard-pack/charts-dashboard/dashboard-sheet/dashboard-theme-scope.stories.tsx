import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ThemeProvider, defineTheme } from "@elabs-ai/components-tokens";

import type { DashboardSpec } from "../core/spec";
import { DashboardProvider, DashboardSheet } from "../dashboard-sheet";
import { textTileKind } from "../tiles/text-tile";
import { DashboardThemeScope } from "./dashboard-theme-scope";

/**
 * The real "Qlik" community theme family (`themes/qlik/theme.ts`), declared here as a literal
 * `ThemeDefinition[]` — never imported from `themes/qlik/` (a copy-own registry asset, D4;
 * `dashboard/` may only import `@elabs-ai/components-{charts,ui,tokens,icons}`,
 * `.claude/rules/dashboard.md`). This mirrors `apps/docs/.storybook/community-themes.generated.ts`'s
 * own `qlik-light`/`qlik-dark` entries value-for-value; the actual `[data-theme="qlik-dark"]` CSS
 * is already loaded globally by Storybook's `preview.css` (every story gets it "for free"), so
 * this scope resolves to the REAL Qlik ink, not a stand-in.
 */
const QLIK_THEMES = [
  defineTheme({
    value: "qlik-light",
    label: "Qlik Bright",
    dark: false,
    family: "qlik",
    familyLabel: "Qlik",
  }),
  defineTheme({ value: "qlik-dark", label: "Qlik Dark", dark: true, family: "qlik" }),
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

/** `spec.theme = { family: "qlik", mode: "dark" }`: the sheet gets the real `qlik-dark`
 * member of the `qlik` family while the story page around it keeps its own theme — the
 * scoped `data-theme` lands on this component's own root, never on `<html>`, and its
 * computed `--background` differs from the page's own (a real, live token, not a literal). */
export const FamilyOverride: Story = {
  render: () => (
    <DashboardThemeScope theme={{ family: "qlik", mode: "dark" }} themes={QLIK_THEMES}>
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
    const scope = canvasElement.querySelector('[data-slot="dashboard-theme-scope"]') as HTMLElement;
    await expect(scope).toHaveAttribute("data-theme", "qlik-dark");
    await expect(document.documentElement.getAttribute("data-theme")).not.toBe("qlik-dark");

    // The real Qlik dark background, computed live — not a literal — differs from the page's.
    const scopeBackground = getComputedStyle(scope).getPropertyValue("--background").trim();
    const pageBackground = getComputedStyle(document.documentElement)
      .getPropertyValue("--background")
      .trim();
    console.info("[RM-087 F5] --background scope=%s page=%s", scopeBackground, pageBackground);
    await expect(scopeBackground).not.toBe("");
    await expect(scopeBackground).not.toBe(pageBackground);
  },
};
