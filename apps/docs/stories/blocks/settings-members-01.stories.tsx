import type { Meta, StoryObj } from "@storybook/react-vite";
import { SettingsMembers } from "@/components/settings-members-01/settings-members";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: SettingsMembers,
  title: "Patterns/Blocks/Account and Settings/Members",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Who has access and what they can do. Roles change in place; the owner can be neither demoted nor removed; inviting checks the address, duplicates and the seat count (shown on a `Meter`); and removing someone asks first and says what they lose. Pending invites are part of the same list.\n\nCopy-own it: `npx shadcn add settings-members-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SettingsMembers>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Every seat is taken: inviting is disabled and the header says where to add seats. */
export const SeatsFull: Story = { args: { seats: 5 } };
