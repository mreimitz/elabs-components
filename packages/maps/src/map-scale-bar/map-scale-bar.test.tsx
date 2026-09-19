import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { MockMap, resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import { MapScaleBar, computeMapScale, metresPerPixel, niceDistance } from "./map-scale-bar";

afterEach(() => {
  cleanup();
  resetMaplibreMock();
});

describe("computeMapScale", () => {
  it("measures Web Mercator metres per pixel", () => {
    // 512 px world at zoom 0 on the equator.
    expect(metresPerPixel(0, 0)).toBeCloseTo(40_075_016.686 / 512, 3);
    expect(metresPerPixel(60, 1)).toBeCloseTo(40_075_016.686 / 512 / 4, 3);
  });

  it("rounds to 1 / 2 / 5 × 10ⁿ", () => {
    expect(niceDistance(87)).toBe(50);
    expect(niceDistance(230)).toBe(200);
    expect(niceDistance(1.4)).toBe(1);
    expect(niceDistance(0)).toBe(0);
  });

  it("recomputes the distance for a narrower bar and switches units", () => {
    const wide = computeMapScale(43.6, 7, "km", 112);
    const narrow = computeMapScale(43.6, 6.3, "km", 80);
    expect(wide.unit).toBe("kilometer");
    expect(narrow.value).not.toBe(wide.value);
    expect(wide.px).toBeLessThanOrEqual(112);
    expect(narrow.px).toBeLessThanOrEqual(80);
    expect(computeMapScale(43.6, 16, "km", 100).unit).toBe("meter");
    expect(computeMapScale(43.6, 7, "mi", 100).unit).toBe("mile");
    expect(computeMapScale(43.6, 16, "mi", 100).unit).toBe("foot");
  });
});

describe("MapScaleBar", () => {
  it("renders a locale-formatted distance and updates as the map moves", async () => {
    render(
      <MapCanvas>
        <MapScaleBar />
      </MapCanvas>,
    );
    const bar = await screen.findByText(/km/);
    const first = bar.textContent;
    const map = MockMap.instances[0]!;
    act(() => {
      map.zoom = 4;
      map.emit("move");
    });
    expect(screen.getByText(/km/).textContent).not.toBe(first);
    expect(document.querySelector('[data-slot="map-scale-bar"]')).toHaveAttribute(
      "data-unit",
      "kilometer",
    );
  });
});
