import type { Meta, StoryObj } from "@storybook/react-vite";
import { SettingsProfile } from "@/components/settings-profile-01/settings-profile";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: SettingsProfile,
  title: "Patterns/Blocks/Account and Settings/Profile",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A profile form that knows whether it is dirty: the save bar appears only when something changed, and Discard puts everything back. Validates on save, counts the bio down to its limit, and keeps the irreversible action in its own zone behind a `ConfirmDialog` that names what is lost.\n\nCopy-own it: `npx shadcn add settings-profile-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SettingsProfile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
