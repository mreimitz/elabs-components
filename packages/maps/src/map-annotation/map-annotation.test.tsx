import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import { MapAnnotation } from "./map-annotation";
import { clampShift, mapAnchorGeometry } from "./anchor";

let rectSpy: MockInstance | null = null;
function atWidth(width: number) {
  rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width,
    height: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

beforeEach(() => {
  rectSpy = null;
});

afterEach(() => {
  rectSpy?.mockRestore();
  cleanup();
  resetMaplibreMock();
});

function ThreeNotes() {
  return (
    <MapCanvas>
      <MapAnnotation longitude={-79.4} latitude={43.7} text="Toronto sits on the north shore." />
      <MapAnnotation
        longitude={-78.9}
        latitude={43.3}
        text="Only on wide maps."
        showAt={{ base: true, narrow: false }}
      />
      <MapAnnotation longitude={-77.5} latitude={43.6} text="The lake is 311 km long." />
      <MapAnnotation longitude={-76.4} latitude={44.2} text="Kingston marks the outlet." />
    </MapCanvas>
  );
}

describe("MapAnnotation", () => {
  it("paints its text with a leader line at wide, and no key", async () => {
    atWidth(868);
    render(<ThreeNotes />);
    expect(await screen.findByText("Toronto sits on the north shore.")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="map-annotation-connector"]')).toHaveLength(4);
    expect(document.querySelector('[data-slot="map-annotation-key"]')).toBeNull();
  });

  it("numbers the shown notes in reading order and keys them under the map at narrow", async () => {
    atWidth(348);
    render(<ThreeNotes />);
    const key = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-slot="map-annotation-key"]');
      expect(el).not.toBeNull();
      return el!;
    });
    const rows = within(key).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.textContent)).toEqual([
      "1Toronto sits on the north shore.",
      "2The lake is 311 km long.",
      "3Kingston marks the outlet.",
    ]);
    // The key sits OUTSIDE the map box, after it.
    const below = document.querySelector('[data-slot="map-canvas-below"]')!;
    expect(below.contains(key)).toBe(true);
    const map = document.querySelector('[data-slot="map-canvas"]')!;
    expect(map.contains(key)).toBe(false);
    // On the map: three numbered markers, the hidden note gone.
    const markers = map.querySelectorAll('[data-slot="map-annotation-number"]');
    expect([...markers].map((m) => m.textContent)).toEqual(["1", "2", "3"]);
    expect(map.querySelectorAll('[data-display="hidden"]')).toHaveLength(1);
  });
});

describe("annotation geometry", () => {
  it("sets the box on the far side of its anchor", () => {
    expect(mapAnchorGeometry("top", 10)).toEqual({ dx: 0, dy: -10, fx: -0.5, fy: -1 });
    expect(mapAnchorGeometry("right", 10)).toEqual({ dx: 10, dy: 0, fx: 0, fy: -0.5 });
    const diagonal = mapAnchorGeometry("bottom-left", 10);
    expect(diagonal.dx).toBeCloseTo(-7.071, 3);
    expect(diagonal.dy).toBeCloseTo(7.071, 3);
  });

  it("clamps a box inside the map on both axes", () => {
    expect(clampShift(330, -20, 60, 30, 348, 348)).toEqual({ sx: -46, sy: 24 });
    expect(clampShift(10, 10, 60, 30, 348, 348)).toEqual({ sx: 0, sy: 0 });
    // Wider than the map: pinned to the start edge.
    expect(clampShift(-50, 10, 500, 30, 348, 348)).toEqual({ sx: 54, sy: 0 });
  });
});
