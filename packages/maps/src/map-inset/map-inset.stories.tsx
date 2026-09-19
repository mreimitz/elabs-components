import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";

import { MapCanvas } from "../map-canvas";
import { LOCATOR_BOUNDS } from "../test-utils/locator-fixture";
import { MapInset } from "./map-inset";

const meta = {
  title: "Maps/MapInset",
  component: MapInset,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MapInset>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A globe inset marks where the main map sits in the world. It is a second,
 * static map; the main view shows as a box (or a dot when the view is too
 * small to draw). It shrinks at `narrow` and never takes more than 40 % of
 * the map width.
 */
export const Default: Story = {
  render: (args) => (
    <div className="w-full p-4">
      <MapCanvas
        interactive={false}
        bounds={LOCATOR_BOUNDS}
        fitBoundsOptions={{ padding: { top: 152, right: 24, bottom: 24, left: 24 } }}
      >
        <MapInset {...args} />
      </MapCanvas>
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector(".maplibregl-canvas")) return;
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll('[data-slot="map-inset"] .maplibregl-canvas'),
      ).toHaveLength(1),
    );
  },
};

/** A zoomed-out flat map of the region instead of a globe, bottom-left. */
export const Region: Story = {
  args: { kind: "region", position: "bottom-left" },
  render: Default.render,
};

/** The remaining corners, at a fixed size. */
export const Corners: Story = {
  render: () => (
    <div className="w-full p-4">
      <MapCanvas interactive={false} center={[-78.2, 43.7]} zoom={6}>
        <MapInset position="top-left" size={96} />
        <MapInset kind="region" position="bottom-right" size={96} />
      </MapCanvas>
    </div>
  ),
};
