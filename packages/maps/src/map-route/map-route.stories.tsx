import type { Meta, StoryObj } from "@storybook/react-vite";

import { MapCanvas } from "../map-canvas";
import { MapMarker, MapMarkerContent, MapMarkerLabel } from "../map-marker";
import { MapRoute } from "./map-route";

// A short cycle route through central Berlin.
const routeCoordinates: [number, number][] = [
  [13.3777, 52.5163],
  [13.3841, 52.5186],
  [13.3903, 52.5209],
  [13.3976, 52.5211],
  [13.4049, 52.5216],
  [13.4132, 52.5219],
  [13.4213, 52.5205],
  [13.4266, 52.5196],
  [13.4318, 52.5211],
];

const meta = {
  title: "Maps/MapRoute",
  component: MapRoute,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MapRoute>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Default paint follows the theme's `--primary` token. */
export const Default: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[13.4049, 52.5196]} zoom={13}>
        <MapRoute coordinates={routeCoordinates} />
        <MapMarker longitude={13.3777} latitude={52.5163}>
          <MapMarkerContent />
          <MapMarkerLabel>Start</MapMarkerLabel>
        </MapMarker>
        <MapMarker longitude={13.4318} latitude={52.5211}>
          <MapMarkerContent />
          <MapMarkerLabel>End</MapMarkerLabel>
        </MapMarker>
      </MapCanvas>
    </div>
  ),
};

export const Dashed: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[13.4049, 52.5196]} zoom={13}>
        <MapRoute coordinates={routeCoordinates} dashArray={[2, 2]} width={2} opacity={0.9} />
      </MapCanvas>
    </div>
  ),
};
