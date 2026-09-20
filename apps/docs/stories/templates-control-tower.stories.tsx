import type { Meta, StoryObj } from "@storybook/react-vite";
import ControlTowerPage from "@/components/control-tower-page/control-tower-page";

/**
 * Renders the SHIPPED registry page, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: ControlTowerPage,
  title: "Patterns/Templates/Operations/Logistics Control Tower",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "For supply-chain, fleet and field-operations teams",
      description: {
        component:
          "The screen an operations team keeps open all day. A headline computed from the exceptions, the two map blocks behind tabs (`geo-network-map-01` on a globe, `geo-fleet-tracker-01` on streets), and an exceptions `DataTable` sorted by the closest promise. Selecting a row SUMMONS the dock — the shipment's promise against its estimate in `Descriptions`, the recommended next step with its two decisions, and the journey as a `Timeline` — so the map and the list stay where they are. The dock is controlled from the page, which is the master-detail pattern for the workspace shell.\n\nCopy-own it: `npx shadcn add control-tower-page`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ControlTowerPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
