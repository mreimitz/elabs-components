import type { Meta, StoryObj } from "@storybook/react-vite";
import { SettingsBilling } from "@/components/settings-billing-01/settings-billing";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: SettingsBilling,
  title: "Patterns/Blocks/Account and Settings/Billing",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The plan and when it renews, usage on `Meter`s against what the plan includes — with the included amount as a marker and the overage said in words once it is crossed — the card on file by its last four digits only, and the invoices in a `Table`.\n\nCopy-own it: `npx shadcn add settings-billing-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SettingsBilling>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
