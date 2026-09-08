// Storybook / test-harness regression guard (#125)
//
// The automated a11y path (`vitest --project storybook` +
// `@storybook/addon-a11y`) runs axe at an unconstrained instant after mount,
// with no wait for animations to settle — and Storybook's own
// `waitForAnimations()` polls `document.getAnimations()`, which never sees a
// Motion/rAF tween. So a JS entrance animation over HTML text makes the
// `color-contrast` assertion non-deterministic: axe either reads a blended
// mid-fade ink (false failure) or skips the node while it sits at `opacity: 0`
// (vacuous pass).
//
// The fix is to run the suite as a user who has asked for reduced motion —
// `context: { reducedMotion: "reduce" }` on the Playwright instance in
// `apps/docs/vitest.config.ts` — so motion-aware components mount at their
// resting state and axe measures the colours that actually ship.
//
// This story is the proof that the flip TOOK. Without it, a Vitest/Playwright
// upgrade could silently drop the option and every reduced-motion claim in the
// suite would go vacuous while staying green.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

const meta = {
  title: "Docs/Storybook Motion Harness",
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Regression guard for #125 — asserts the automated \`vitest --project storybook\`
run really reports \`prefers-reduced-motion: reduce\`, which is what keeps the
axe \`color-contrast\` assertion measuring resting colours instead of sampling a
JS entrance animation in flight.
        `,
      },
    },
  },
  render: () => <p>This story only asserts a harness invariant in its play function.</p>,
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * True only inside a standalone `vitest --project storybook` run — the same
 * seam `@storybook/addon-a11y` uses to decide whether to turn violations into a
 * failed assertion (`getIsVitestStandaloneRun`). The reduced-motion flip is a
 * property of THAT runner's browser context, not of the dev server, so a human
 * opening this story in Storybook must not be told their OS setting is wrong.
 */
const IS_VITEST_STORYBOOK_RUN =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITEST_STORYBOOK ===
  "false";

export const RunsUnderReducedMotion: Story = {
  name: "the test runner reports prefers-reduced-motion: reduce",
  play: async () => {
    if (!IS_VITEST_STORYBOOK_RUN) return;
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
  },
};
