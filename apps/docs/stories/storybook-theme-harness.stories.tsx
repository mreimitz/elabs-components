// Storybook / test-harness regression guard (#402)
//
// `test-storybook` (`@storybook/addon-vitest` + `@storybook/addon-a11y`,
// `parameters.a11y.test: "error"`) is the mechanized proof of "Theme-safe"
// (`.claude/rules/quality-gates.md`). That proof is only real if the harness
// actually applies a theme before axe runs — #402 found that it silently
// evaluated every story against the unbranded `:root` fallback palette
// instead, because the `withThemeByDataAttribute` decorator's effect never
// landed on `document.documentElement` inside this specific harness.
//
// This story is a harness-level assertion, not a component test: its ONLY
// job is to fail loudly, immediately, if a future Storybook/addon upgrade
// reintroduces the same silent breakage. No `globals` override — this is the
// harness's own DEFAULT behavior under test.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { DEFAULT_THEME } from "@elabs/components-tokens";

const meta = {
  title: "Providers/Storybook Theme Harness",
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Regression guard for #402 — asserts the automated \`test-storybook\` harness
(\`vitest --project storybook\`) actually applies \`data-theme\` to
\`document.documentElement\` before a story's a11y check runs. If a future
Storybook/addon upgrade silently drops theme application again (as #402
found), this story fails immediately instead of the defect being
rediscovered by manual instrumentation.
        `,
      },
    },
  },
  render: () => <p>This story only asserts a harness invariant in its play function.</p>,
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const AppliesDefaultTheme: Story = {
  name: "applies default theme (no globals override)",
  play: async () => {
    // The decorator applies the theme via a `useEffect`, so it lands one tick
    // after the initial render/commit — `waitFor` covers that, not a race.
    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME);
    });
  },
};
