import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { colorScaleFor } from "@elabs-ai/components-ui";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import { MapLegend } from "./map-legend";

afterEach(() => {
  cleanup();
  resetMaplibreMock();
});

const VALUES = [3, 8, 12, 19, 25, 31, 44, 52, 60];

describe("MapLegend", () => {
  it("renders marker rows with their swatches, over a corner", async () => {
    render(
      <MapCanvas>
        <MapLegend
          title="Markers"
          position="top-left"
          items={[
            { label: "Lake", color: "var(--chart-1)", shape: "square" },
            { label: "City", color: "var(--chart-2)" },
          ]}
        />
      </MapCanvas>,
    );
    expect(await screen.findByText("Lake")).toBeInTheDocument();
    const legend = document.querySelector<HTMLElement>('[data-slot="map-legend"]')!;
    expect(legend).toHaveAttribute("data-position", "top-left");
    // Inside the map box, over the corner.
    expect(document.querySelector('[data-slot="map-canvas"]')!.contains(legend)).toBe(true);
    const swatches = legend.querySelectorAll<HTMLElement>('[data-slot="map-legend-swatch"]');
    expect([...swatches].map((s) => s.dataset.shape)).toEqual(["square", "circle"]);
  });

  it("portals into the strip below the map when positioned below", async () => {
    render(
      <MapCanvas>
        <MapLegend position="below" items={[{ label: "Lake", color: "var(--chart-1)" }]} />
      </MapCanvas>,
    );
    await screen.findByText("Lake");
    const legend = document.querySelector('[data-slot="map-legend"]')!;
    expect(document.querySelector('[data-slot="map-canvas-below"]')!.contains(legend)).toBe(true);
    expect(document.querySelector('[data-slot="map-canvas"]')!.contains(legend)).toBe(false);
  });

  it("keys a stepped scale with token-reference swatches only", async () => {
    render(
      <MapCanvas>
        <MapLegend scale={{ values: VALUES, spec: { type: "stepped", steps: 4 } }} />
      </MapCanvas>,
    );
    await waitFor(() =>
      expect(document.querySelectorAll('[data-slot="map-legend-step"]')).toHaveLength(4),
    );
    const steps = document.querySelectorAll<HTMLElement>('[data-slot="map-legend-step"]');
    for (const step of steps) {
      expect(step.getAttribute("style")).toMatch(/^background: var\(--chart-seq-\d\);$/);
    }
    // 4 steps → 5 boundary ticks.
    expect(document.querySelectorAll('[data-slot="map-legend-tick"]')).toHaveLength(5);
  });

  it("draws a continuous scale as a gradient of token references", async () => {
    const scale = colorScaleFor(VALUES, { type: "continuous" });
    render(
      <MapCanvas>
        <MapLegend scale={scale} formatValue={(v) => `${v}%`} />
      </MapCanvas>,
    );
    const gradient = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-slot="map-legend-gradient"]');
      expect(el).not.toBeNull();
      return el!;
    });
    const style = gradient.getAttribute("style") ?? "";
    expect(style).toContain("linear-gradient(to right, var(--chart-seq-1) 0%");
    expect(style).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|oklch\(/i);
    expect(screen.getByText("3%")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("lists a categorical scale as swatch rows", async () => {
    render(
      <MapCanvas>
        <MapLegend
          scale={{
            values: ["Park", "Water", "Park"],
            spec: { type: "stepped", palette: "categorical" },
          }}
        />
      </MapCanvas>,
    );
    expect(await screen.findByText("Park")).toBeInTheDocument();
    expect(screen.getByText("Water")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="map-legend-ramp"]')).toBeNull();
  });
});
