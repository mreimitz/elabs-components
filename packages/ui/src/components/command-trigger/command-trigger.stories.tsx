import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { CommandTrigger } from "./command-trigger";

const meta = {
  title: "Navigation/CommandTrigger",
  component: CommandTrigger,
  parameters: {
    docs: {
      description: {
        component:
          "The command-palette opener a top bar reaches for: shaped like a search field, " +
          "collapsing to just the icon under `sm`. The visible label and the shortcut `Kbd` are " +
          "both decorative — the accessible name is authored with `aria-label` so the shortcut " +
          "glyph never concatenates into it (#117).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CommandTrigger>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Default label and platform-detected shortcut. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button");
    // #117: the Kbd's shortcut glyph must not pollute the computed name.
    await expect(button).toHaveAccessibleName("Search");
  },
};

/** A caller-supplied label and shortcut — useful when the platform guess is wrong. */
export const WithCustomShortcut: Story = {
  args: {
    label: "Find anything",
    shortcut: "Ctrl K",
  },
};
