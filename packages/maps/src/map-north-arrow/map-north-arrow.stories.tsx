import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";

import { MapCanvas } from "../map-canvas";
import { MapNorthArrow } from "./map-north-arrow";

const meta = {
  title: "Maps/MapNorthArrow",
  component: MapNorthArrow,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MapNorthArrow>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A rotated map (bearing 30°) shows the arrow, turned to point at true north.
 * On a north-up map the arrow stays hidden — it would only state the default.
 */
export const Default: Story = {
  render: (args) => (
    <div className="w-full p-4">
      <MapCanvas interactive={false} center={[-79.38, 43.65]} zoom={9} bearing={30}>
        <MapNorthArrow {...args} />
      </MapCanvas>
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector(".maplibregl-canvas")) return;
    await waitFor(() => {
      const arrow = canvasElement.querySelector<HTMLElement>('[data-slot="map-north-arrow"]');
      expect(arrow).not.toBeNull();
      expect(arrow!.hidden).toBe(false);
    });
  },
};

/** North-up: nothing to show. */
export const NorthUp: Story = {
  render: () => (
    <div className="w-full p-4">
      <MapCanvas interactive={false} center={[-79.38, 43.65]} zoom={9}>
        <MapNorthArrow />
      </MapCanvas>
    </div>
  ),
};

/** In another corner, with a translated name. */
export const Positioned: Story = {
  args: { position: "bottom-right", label: "Norden" },
  render: Default.render,
};

/** The remaining corners. */
export const OtherCorners: Story = {
  render: () => (
    <div className="w-full p-4">
      <MapCanvas interactive={false} center={[-79.38, 43.65]} zoom={9} bearing={-45}>
        <MapNorthArrow position="top-right" />
        <MapNorthArrow position="bottom-left" />
      </MapCanvas>
    </div>
  ),
};
