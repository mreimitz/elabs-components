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
  // Four rows, four colours (c-12): `var(--primary)` aliases `var(--chart-1)`
  // in every shipped theme, so a "City" circle painted with it was the same
  // colour as the "Lake Ontario" square — a distinction the marks can't carry.
  { id: "city", label: "City", color: "var(--chart-4)", shape: "circle" },
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
  play: async ({ canvasElement }) => {
    // c-12: four rows, four colours. `var(--primary)` aliases `var(--chart-1)`
    // in every shipped theme, so the "City" circle and the "Lake Ontario"
    // square were painted the same — a distinction the marks could not carry,
    // with only a 10 px shape to tell them apart.
    const swatches = await waitFor(() => {
      const found = [
        ...canvasElement.querySelectorAll<HTMLElement>('[data-slot="map-legend-swatch"]'),
      ];
      expect(found).toHaveLength(ITEMS.length);
      return found;
    });
    const colors = swatches.map((swatch) => getComputedStyle(swatch).backgroundColor);
    await expect(new Set(colors).size).toBe(ITEMS.length);
  },
};

/** The same key as a grid, under the map — for keys wider than a corner. */
export const GridBelow: Story = {
  render: () => (
    <Frame>
      <MapLegend title="Legend" position="below" layout="grid" items={ITEMS} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    // c-5: `auto-fill` held 7 tracks of 113.7 px on the 868 px strip for these
    // four keys, so "Greater Toronto Area" truncated (scrollWidth 123 vs
    // clientWidth 98) with three EMPTY tracks beside it. `auto-fit` collapses
    // the empty tracks, so the strip never carries more tracks than keys.
    const list = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>('[data-slot="map-legend-items"]');
      expect(found).not.toBeNull();
      return found!;
    });
    const tracks = getComputedStyle(list)
      .gridTemplateColumns.split(" ")
      .map((value) => Number.parseFloat(value));
    const filled = tracks.filter((width) => width > 0);
    await expect(filled.length).toBeLessThanOrEqual(ITEMS.length);

    // On a strip wide enough to hold every key in one row, none of them
    // truncates any more.
    if (filled.length === ITEMS.length) {
      for (const item of canvasElement.querySelectorAll('[data-slot="map-legend-item"]')) {
        const label = item.querySelector("span:not([data-slot])") as HTMLElement;
        await expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
      }
    }
  },
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
