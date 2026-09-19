import type { Meta, StoryObj } from "@storybook/react-vite";
import { GeoNetworkMap } from "@/components/geo-network-map-01/geo-network-map";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: GeoNetworkMap,
  title: "Patterns/Blocks/Maps and Geo/Network Map",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "Where does the volume flow, and which lane is late?",
      description: {
        component:
          "A network on the map it runs on. `MapCanvas` in globe projection carries one `MapArc` per lane, its width bound to the lane's volume through a paint expression; hubs are `MapMarker`s with a tooltip each. The panel ranks the lanes with a `Meter` against the busiest one and calls out the ones under the on-time floor. Selecting a lane — on the map or in the list — dims the rest and redraws that arc heavier. `blank` drops the basemap so the block makes no tile request.\n\nCopy-own it: `npx shadcn add geo-network-map-01`.",
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
} satisfies Meta<typeof GeoNetworkMap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The same network on a flat map — better when every lane must be visible at once. */
export const FlatMap: Story = { args: { globe: false } };

/** No basemap: arcs and hubs on a blank canvas, and no request to a tile server. */
export const BlankCanvas: Story = { args: { blank: true, globe: false } };
