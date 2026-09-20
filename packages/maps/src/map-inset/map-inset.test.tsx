import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { MockMap, resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import { MapInset } from "./map-inset";

afterEach(() => {
  cleanup();
  resetMaplibreMock();
});

describe("MapInset", () => {
  it("renders a second, static globe canvas that marks the main view", async () => {
    render(
      <MapCanvas>
        <MapInset />
      </MapCanvas>,
    );
    await waitFor(() => expect(MockMap.instances).toHaveLength(2));
    const inset = MockMap.instances[1]!;
    expect(inset.options.dragPan).toBe(false);
    expect(inset.options.scrollZoom).toBe(false);
    await waitFor(() =>
      expect([...inset.layers.keys()].some((id) => id.includes("map-inset-box"))).toBe(true),
    );
    const wrapper = document.querySelector<HTMLElement>('[data-slot="map-inset"]')!;
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    expect(wrapper).toHaveAttribute("data-kind", "globe");
    expect(wrapper.style.maxWidth).toBe("40%");
  });

  it("uses a zoomed-out mercator map for a region inset", async () => {
    render(
      <MapCanvas zoom={7}>
        <MapInset kind="region" />
      </MapCanvas>,
    );
    await waitFor(() => expect(MockMap.instances).toHaveLength(2));
    expect(MockMap.instances[1]!.options.projection).toBeUndefined();
    expect(document.querySelector('[data-slot="map-inset"]')).toHaveAttribute(
      "data-kind",
      "region",
    );
  });
});

describe("MapInset — a locator shape, not a second map (c-6)", () => {
  /** The globe zoom the inset asked for on its last update. */
  function lastGlobeZoom(inset: MockMap): number | undefined {
    const call = [...inset.jumpToCalls].reverse().find((c) => typeof c?.zoom === "number");
    return call?.zoom as number | undefined;
  }

  it("fills the frame with the globe at every latitude", async () => {
    render(
      <MapCanvas>
        <MapInset kind="globe" />
      </MapCanvas>,
    );
    await waitFor(() => expect(MockMap.instances).toHaveLength(2));
    const main = MockMap.instances[0]!;
    const inset = MockMap.instances[1]!;
    // jsdom measures nothing: give the inset box the 96 px it has at `narrow`.
    Object.defineProperty(inset.getContainer(), "clientWidth", { value: 96, configurable: true });
    act(() => inset.emit("resize"));

    /** Move the MAIN map and wait for the inset to re-frame its globe. */
    async function globeZoomAt(lng: number, lat: number) {
      const before = inset.jumpToCalls.length;
      main.center = { lng, lat };
      act(() => main.emit("moveend"));
      await waitFor(() => expect(inset.jumpToCalls.length).toBeGreaterThan(before));
      return lastGlobeZoom(inset);
    }

    const atToronto = await globeZoomAt(-79.38, 43.65);
    const atEquator = await globeZoomAt(9.4, 0); // the Gulf of Guinea

    // Before the fix the zoom carried a Mercator cos(latitude) factor, so the
    // same globe came out log2(cos 43.65°) = 0.47 zoom levels smaller over
    // Toronto than over the equator.
    expect(atToronto).toBeCloseTo(Math.log2((0.9 * 96 * Math.PI) / 512), 6);
    expect(atToronto).toBeCloseTo(atEquator!, 6);
  });

  it("drops the basemap's own labels inside the frame by default", async () => {
    const { rerender } = render(
      <MapCanvas>
        <MapInset kind="globe" basemapLabels />
      </MapCanvas>,
    );
    await waitFor(() => expect(MockMap.instances).toHaveLength(2));
    const inset = MockMap.instances[1]!;
    inset.addLayer({
      id: "place-continent",
      type: "symbol",
      layout: { "text-field": ["get", "name"] },
    });

    rerender(
      <MapCanvas>
        <MapInset kind="globe" />
      </MapCanvas>,
    );
    await waitFor(() =>
      expect(inset.getLayoutProperty("place-continent", "visibility")).toBe("none"),
    );
    // The MAIN map keeps its own labels — the default is the inset's alone.
    expect(MockMap.instances[0]!.layoutProperties.size).toBe(0);
  });
});
