import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { MockMap, resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import { MapNorthArrow } from "./map-north-arrow";

afterEach(() => {
  cleanup();
  resetMaplibreMock();
});

describe("MapNorthArrow", () => {
  it("stays away on a north-up map and appears once the map rotates", async () => {
    render(
      <MapCanvas>
        <MapNorthArrow />
      </MapCanvas>,
    );
    const arrow = await waitFor(() => {
      const el = document.querySelector('[data-slot="map-north-arrow"]');
      expect(el).not.toBeNull();
      return el!;
    });
    expect(arrow).toHaveAttribute("hidden");
    act(() => {
      MockMap.instances[0]!.bearing = 30;
      MockMap.instances[0]!.emit("rotate");
    });
    expect(arrow).not.toHaveAttribute("hidden");
    expect(screen.getByRole("img", { name: "North" })).toBeVisible();
    expect(arrow.querySelector("svg")!.style.transform).toBe("rotate(-30deg)");
  });
});
