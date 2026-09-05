import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
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
