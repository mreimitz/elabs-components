import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";

import { MapCanvas } from "../map-canvas";
import { MapScaleBar } from "./map-scale-bar";

const meta = {
  title: "Maps/MapScaleBar",
  component: MapScaleBar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MapScaleBar>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A kilometre bar at the bottom-left. Its length snaps to a round distance
 * (1, 2, 5 × 10ⁿ) and is recomputed whenever the view or the map width
 * changes — a narrow map gets a shorter bar.
 */
export const Default: Story = {
  render: (args) => (
    <div className="w-full p-4">
      <MapCanvas interactive={false} center={[-78.2, 43.7]} zoom={6.5}>
        <MapScaleBar {...args} />
      </MapCanvas>
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector(".maplibregl-canvas")) return;
    const bar = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLElement>('[data-slot="map-scale-bar"]');
      expect(el).not.toBeNull();
      expect(Number(el!.dataset.distance)).toBeGreaterThan(0);
      return el!;
    });
    await expect(bar).toHaveAttribute("data-unit", "kilometer");
  },
};

/** Miles, in the bottom-right corner. */
export const Miles: Story = {
  args: { unit: "mi", position: "bottom-right" },
  render: Default.render,
};

/** Zoomed in far enough that the bar switches to metres. */
export const Metres: Story = {
  args: { position: "top-left" },
  render: (args) => (
    <div className="w-full p-4">
      <MapCanvas interactive={false} center={[-79.38, 43.65]} zoom={15}>
        <MapScaleBar {...args} />
      </MapCanvas>
    </div>
  ),
};

/** The last corner. */
export const TopRight: Story = {
  args: { position: "top-right" },
  render: Default.render,
};
