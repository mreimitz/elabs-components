import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";

import { MapCanvas } from "../map-canvas";
import { LOCATOR_BOUNDS } from "../test-utils/locator-fixture";
import { MAP_CORNERS } from "./map-corner";
import { MapLegend, type MapLegendItem } from "./map-legend";

const meta = {
  title: "Maps/MapLegend",
  component: MapLegend,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MapLegend>;
export default meta;
type Story = StoryObj<typeof meta>;

const ITEMS: MapLegendItem[] = [
  { id: "lake", label: "Lake Ontario", color: "var(--chart-1)", shape: "square" },
  { id: "gta", label: "Greater Toronto Area", color: "var(--chart-2)", shape: "square" },
  { id: "city", label: "City", color: "var(--primary)", shape: "circle" },
  { id: "ferry", label: "Ferry route", color: "var(--chart-3)", shape: "line" },
];

const RENT_INDEX = [62, 71, 74, 80, 86, 91, 97, 104, 112, 118, 125, 131, 140];

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="w-full p-4">
      <MapCanvas interactive={false} bounds={LOCATOR_BOUNDS} fitBoundsOptions={{ padding: 32 }}>
        {children}
      </MapCanvas>
    </div>
  );
}

/** A key for markers and areas, laid out as a list over the top-left corner. */
export const Default: Story = {
  render: () => (
    <Frame>
      <MapLegend title="Legend" position="top-left" items={ITEMS} />
    </Frame>
  ),
};

/** The same key as a grid, under the map — for keys wider than a corner. */
export const GridBelow: Story = {
  render: () => (
    <Frame>
      <MapLegend title="Legend" position="below" layout="grid" items={ITEMS} />
    </Frame>
  ),
};

/** Above the map, as a list. */
export const Above: Story = {
  render: () => (
    <Frame>
      <MapLegend title="Legend" position="above" layout="list" items={ITEMS} />
    </Frame>
  ),
};

/**
 * A stepped ramp from the shared colour-scale helper: every swatch is a
 * `var(--chart-seq-N)` reference, so the ramp follows the theme.
 */
export const SteppedRamp: Story = {
  render: () => (
    <Frame>
      <MapLegend
        title="Rent index (Toronto = 100)"
        position="bottom-right"
        scale={{ values: RENT_INDEX, spec: { type: "stepped", steps: 5 } }}
      />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector(".maplibregl-canvas")) return;
    const steps = await waitFor(() => {
      const found = canvasElement.querySelectorAll<HTMLElement>('[data-slot="map-legend-step"]');
      expect(found).toHaveLength(5);
      return found;
    });
    for (const step of steps) {
      await expect(step.getAttribute("style") ?? "").toMatch(/var\(--chart-seq-\d\)/);
    }
  },
};

/** A continuous ramp, drawn as a gradient of token references. */
export const ContinuousRamp: Story = {
  render: () => (
    <Frame>
      <MapLegend
        title="Rent index"
        position="bottom-left"
        scale={{ values: RENT_INDEX, spec: { type: "continuous" } }}
        formatValue={(value) => `${value}`}
      />
    </Frame>
  ),
};

/** Every corner a key can sit in. */
export const Corners: Story = {
  render: () => (
    <Frame>
      {MAP_CORNERS.map((corner) => (
        <MapLegend
          key={corner}
          position={corner}
          items={[{ id: corner, label: corner, color: "var(--chart-1)" }]}
        />
      ))}
    </Frame>
  ),
};

/** Over a corner on wide maps; under the map at `narrow`, where it would cover data. */
export const ResponsivePosition: Story = {
  render: () => (
    <Frame>
      <MapLegend title="Legend" position={{ base: "top-right", narrow: "below" }} items={ITEMS} />
    </Frame>
  ),
};
