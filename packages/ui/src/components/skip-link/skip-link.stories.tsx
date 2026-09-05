import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
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
 * `<main id="main-content" tabIndex={-1}>` target. It proves the tab-order
 * claim for real: tabbing from a blurred page lands on the skip link ahead of
 * every one of those competing controls. The second claim — that ACTIVATING
 * the link moves real focus rather than merely scrolling — is only checked at
 * the precondition level here (see the comment in the play function); this
 * harness cannot exercise the activation itself.
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

    // PRECONDITIONS only, not proof: activating the link really moving focus
    // to the main landmark cannot be exercised in this harness — Playwright's
    // pointer-driven `.click()` on a same-document `href="#…"` anchor makes
    // this `@vitest/browser` composed-story runner tear down the page and
    // report its own WebSocket connection as closed, even though the
    // navigation itself is ordinary. So this locks the two things the
    // focus-move mechanism depends on instead: the href fragment targets the
    // right id, and that id is programmatically focusable.
    const main = canvasElement.querySelector("#main-content") as HTMLElement;
    await expect(link.getAttribute("href")).toBe(`#${main.id}`);
    await expect(main.tabIndex).toBe(-1);
  },
};
