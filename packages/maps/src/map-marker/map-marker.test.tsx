import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { MockMarker, resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import { MapMarker, MapMarkerContent, MapMarkerLabel } from "./map-marker";

afterEach(() => {
  cleanup();
  resetMaplibreMock();
});

describe("MapMarker", () => {
  it("adds the marker to the map at the given position", async () => {
    render(
      <MapCanvas>
        <MapMarker longitude={13.4} latitude={52.52}>
          <MapMarkerContent />
        </MapMarker>
      </MapCanvas>,
    );
    await waitFor(() => {
      expect(MockMarker.instances).toHaveLength(1);
      expect(MockMarker.instances[0]!.addedTo).not.toBeNull();
    });
    expect(MockMarker.instances[0]!.lngLat).toEqual({ lng: 13.4, lat: 52.52 });
  });

  it("portals content into the marker element (default icon)", async () => {
    render(
      <MapCanvas>
        <MapMarker longitude={0} latitude={0}>
          <MapMarkerContent />
        </MapMarker>
      </MapCanvas>,
    );
    await waitFor(() => {
      expect(MockMarker.instances[0]!.element.querySelector(".bg-primary")).not.toBeNull();
    });
  });

  it("renders custom content and labels", async () => {
    render(
      <MapCanvas>
        <MapMarker longitude={0} latitude={0}>
          <MapMarkerContent>
            <span data-testid="pin">pin</span>
          </MapMarkerContent>
          <MapMarkerLabel>Berlin</MapMarkerLabel>
        </MapMarker>
      </MapCanvas>,
    );
    await waitFor(() => {
      const el = MockMarker.instances[0]!.element;
      expect(el.querySelector("[data-testid='pin']")).not.toBeNull();
      // The label anchors to the marker element even when composed as a
      // SIBLING of MapMarkerContent (it portals itself).
      expect(el.textContent).toContain("Berlin");
    });
  });

  it("removes the marker on unmount", async () => {
    const { unmount } = render(
      <MapCanvas>
        <MapMarker longitude={0} latitude={0}>
          <MapMarkerContent />
        </MapMarker>
      </MapCanvas>,
    );
    await waitFor(() => {
      expect(MockMarker.instances[0]!.addedTo).not.toBeNull();
    });
    unmount();
    expect(MockMarker.instances[0]!.addedTo).toBeNull();
  });
});
