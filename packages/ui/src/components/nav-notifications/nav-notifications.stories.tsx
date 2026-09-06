import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { NavNotifications } from "./nav-notifications";

const meta = {
  title: "Navigation/Nav Notifications",
  component: NavNotifications,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          'A bell button that opens a short list of recent notifications. Placement is the caller\'s decision, not the component\'s: the defaults (`side="right"`, the `my-6` inset) suit a bell sitting in a left-hand nav rail, while a bell at the end of a top bar passes `side="bottom" align="end"` so the menu hangs below its trigger instead of being collision-flipped back across the controls beside it.',
      },
    },
  },
  argTypes: {
    notifications: { control: false, table: { category: "Content" } },
    viewAllLabel: { control: "text", table: { category: "Content" } },
    side: { control: "inline-radio", table: { category: "Placement" } },
    align: { control: "inline-radio", table: { category: "Placement" } },
    className: { control: "text", table: { category: "Styling" } },
  },
} satisfies Meta<typeof NavNotifications>;
export default meta;
type Story = StoryObj<typeof meta>;

const NOTIFICATIONS = [
  { id: "n1", fallback: "OR", text: "Order 4821 is waiting on stock.", time: "10m ago" },
  { id: "n2", fallback: "PY", text: "This week’s payout cleared.", time: "1h ago" },
  { id: "n3", fallback: "CS", text: "Three customers asked about delivery.", time: "2h ago" },
];

/** The rail placement — the shipped defaults, unchanged. */
export const Default: Story = {
  args: { notifications: NOTIFICATIONS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open notifications" }));
    // The menu is portalled to <body>, so it is reached through the document,
    // not the canvas.
    await waitFor(() => expect(document.querySelector('[role="menu"]')).toBeVisible());
    await expect(document.querySelector('[role="menu"]')).toHaveAttribute("data-side", "right");
    // Close it before the story settles. While a Radix menu is open its
    // siblings carry `aria-hidden`, and the trigger inside one of them is
    // still focusable — which axe reports as `aria-hidden-focus` against the
    // ANCESTOR, not against anything this component authored. Leaving the menu
    // open would fail the a11y pass on library behaviour the story is not
    // testing.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(document.querySelector('[role="menu"]')).toBeNull());
  },
};

/**
 * The top-bar placement. `side="bottom" align="end"` puts the menu under the
 * bell and flush with its outer edge; `my-0` drops the rail inset that would
 * otherwise push it 24px clear of the bar. Asserted on Radix's own resolved
 * `data-side`, which reports where the menu ACTUALLY landed after collision
 * handling — a class-name assertion would pass on a menu that flipped.
 */
export const TopBarPlacement: Story = {
  args: {
    notifications: NOTIFICATIONS,
    side: "bottom",
    align: "end",
    className: "my-0",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open notifications" }));
    const content = await waitFor(() => {
      const node = document.querySelector('[role="menu"]');
      expect(node).toBeVisible();
      return node;
    });
    await expect(content).toHaveAttribute("data-side", "bottom");
    await expect(content).toHaveAttribute("data-align", "end");
    // Closed for the same reason as `Default` — see the note there.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(document.querySelector('[role="menu"]')).toBeNull());
  },
};
