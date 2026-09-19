import type { Meta, StoryObj } from "@storybook/react-vite";
import { GeoFleetTracker } from "@/components/geo-fleet-tracker-01/geo-fleet-tracker";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: GeoFleetTracker,
  title: "Patterns/Blocks/Maps and Geo/Fleet Tracker",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "Where is everyone, and who is late?",
      description: {
        component:
          "A fleet where it is. Each vehicle's planned route is a dashed `MapRoute`, the part already driven a solid one, with the vehicle's `MapMarker` at the join and the depot marked. The list beside it shows stops done on a `Meter` and minutes against plan; selecting a vehicle — in the list or on the map — fades the others. `blank` drops the basemap.\n\nCopy-own it: `npx shadcn add geo-fleet-tracker-01`.",
      },
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-[640px] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GeoFleetTracker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No basemap: routes on a blank canvas, and no request to a tile server. */
export const BlankCanvas: Story = { args: { blank: true } };
