import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { CommandTrigger } from "../command-trigger";
import { SkipLink } from "./skip-link";

const meta = {
  title: "Navigation/Skip Link",
  component: SkipLink,
  parameters: {
    docs: {
      description: {
        component:
          'The first focusable element of an application. Invisible until it receives focus, then a pill in the top-start corner that jumps past the whole nav rail to the page\'s `<main>`. Give the target `id="main-content"` and `tabIndex={-1}` so focus lands there rather than merely scrolling.',
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SkipLink>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Press Tab: the link appears. It is the only way a keyboard user skips the rail. */
export const Default: Story = {
  render: () => (
    <div>
      <SkipLink />
      <nav aria-label="Primary" className="p-4 text-body text-muted-foreground">
        nav links live here
      </nav>
      <main id="main-content" tabIndex={-1} className="p-4 text-body">
        Main content
      </main>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const link = canvasElement.querySelector('[data-slot="skip-link"]') as HTMLElement;
    await expect(link).toHaveFocus();
    // Not-sr-only when focused: it has real painted size.
    await expect(link.getBoundingClientRect().width).toBeGreaterThan(40);
  },
};

/**
 * Finding 3 (task-11f-brief.md): the `Default` story above has no competing
 * focusable furniture, so its own "the link comes first" assertion is
 * vacuous — it would pass on a page with the link anywhere in the tab order,
 * because there is nothing else to come before. This story composes the
 * link inside a realistic shell — a `CommandTrigger` plus real nav
 * `<a>`/`<button>` elements genuinely competing for first place — and a real
 * `<main id="main-content" tabIndex={-1}>` target, then proves BOTH of the
 * component's claims for real: tabbing from a blurred page lands on the skip
 * link ahead of every one of those competing controls, and ACTIVATING it
 * moves real focus to the main landmark rather than merely scrolling to it.
 */
export const RealisticShell: Story = {
  render: () => (
    <div>
      <SkipLink />
      <header className="flex items-center justify-between gap-4 border-b border-border p-4">
        <nav aria-label="Primary" className="flex items-center gap-4">
          <a href="#dashboard" className="text-body text-foreground">
            Dashboard
          </a>
          <a href="#reports" className="text-body text-foreground">
            Reports
          </a>
          <button type="button" className="text-body text-foreground">
            Settings
          </button>
        </nav>
        <CommandTrigger />
      </header>
      <main id="main-content" tabIndex={-1} className="p-4 text-body">
        Main content
      </main>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Start from a blurred page so Tab lands on whatever is genuinely FIRST
    // in the DOM's tab order — not on whatever the previous story left
    // focused.
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.tab();
    const link = canvasElement.querySelector('[data-slot="skip-link"]') as HTMLElement;
    await expect(link).toHaveFocus();

    // Activating the link must MOVE FOCUS to the main landmark, not just
    // scroll the page to it. Use the element's own `.click()` rather than
    // `userEvent.click()` — Playwright's pointer-driven click on a same-page
    // `href="#…"` anchor makes this specific `@vitest/browser` composed-story
    // harness tear down the page mid-navigation and report its OWN
    // WebSocket connection as closed ("Browser connection was closed while
    // running tests"), even though the navigation itself is ordinary,
    // spec-compliant same-document hash activation. `.click()` still runs
    // the browser's real, native link-activation steps (this is not a
    // synthetic/untrusted event — the UA performs the same default action a
    // pointer click would), so the assertion below still proves the real
    // mechanism SkipLink depends on; it just reaches it by a call that this
    // harness's automation layer doesn't intercept. The focus move is not
    // synchronous with activation, so poll for it rather than asserting
    // immediately.
    link.click();
    const main = canvasElement.querySelector("#main-content") as HTMLElement;
    await waitFor(() => expect(main).toHaveFocus());
  },
};
