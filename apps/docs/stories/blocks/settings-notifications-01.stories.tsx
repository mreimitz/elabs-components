import type { Meta, StoryObj } from "@storybook/react-vite";
import { SettingsNotifications } from "@/components/settings-notifications-01/settings-notifications";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: SettingsNotifications,
  title: "Patterns/Blocks/Account and Settings/Notifications",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A matrix of what against where, as a real table with row and column headers. Every `Switch` has a full accessible name, a locked cell says why it is locked, and the description counts the events that currently reach you nowhere.\n\nCopy-own it: `npx shadcn add settings-notifications-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SettingsNotifications>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
