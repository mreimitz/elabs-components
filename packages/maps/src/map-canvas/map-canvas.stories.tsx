import type { Meta, StoryObj } from "@storybook/react-vite";

import { MapCanvas } from "./map-canvas";
import { MapControls } from "../map-controls";

const meta = {
  title: "Maps/MapCanvas",
  component: MapCanvas,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MapCanvas>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[13.405, 52.52]} zoom={11}>
        <MapControls />
      </MapCanvas>
    </div>
  ),
};

/** The `loading` prop shows an accessible overlay while the app fetches map data. */
export const Loading: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[13.405, 52.52]} zoom={11} loading />
    </div>
  ),
};

/** Pin the basemap flavor regardless of the active brand theme. */
export const ForcedDarkBasemap: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[-74.006, 40.7128]} zoom={10} theme="dark">
        <MapControls />
      </MapCanvas>
    </div>
  ),
};

/** A globe projection — pairs well with `blank` + data layers for data-viz. */
export const Globe: Story = {
  render: () => (
    <div className="h-[480px]">
      <MapCanvas center={[10, 30]} zoom={1.5} projection={{ type: "globe" }}>
        <MapControls showCompass />
      </MapCanvas>
    </div>
  ),
};
