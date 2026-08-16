import type { Meta, StoryObj } from "@storybook/react-vite";

import { MapCanvas } from "../map-canvas";
import { MapControls } from "./map-controls";

const meta = {
  title: "Maps/MapControls",
  component: MapControls,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MapControls>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[2.3522, 48.8566]} zoom={11}>
        <MapControls />
      </MapCanvas>
    </div>
  ),
};

export const AllControls: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[2.3522, 48.8566]} zoom={11} pitch={30} bearing={-20}>
        <MapControls showZoom showCompass showLocate showFullscreen />
      </MapCanvas>
    </div>
  ),
};

export const TopLeft: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[2.3522, 48.8566]} zoom={11}>
        <MapControls position="top-left" showCompass />
      </MapCanvas>
    </div>
  ),
};
