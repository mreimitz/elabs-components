import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { MockMarker, MockPopup, resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import { MapMarker, MapMarkerContent, MapMarkerLabel, MapMarkerTooltip } from "./map-marker";

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

  it("opens its tooltip on focus and Escape, not only under a pointer", async () => {
    // MapLibre gives a marker a tab stop only inside `setPopup`, and binds no
    // key handler at all — so a hover-only tooltip is unreachable (WCAG 2.1.1)
    // and undismissable (1.4.13). The tooltip asks for both itself.
    render(
      <MapCanvas>
        <MapMarker longitude={13.4} latitude={52.52}>
          <MapMarkerContent />
          <MapMarkerTooltip>Berlin</MapMarkerTooltip>
        </MapMarker>
      </MapCanvas>,
    );
    await waitFor(() => expect(MockPopup.instances).toHaveLength(1));
    const element = MockMarker.instances[0]!.getElement();
    const tooltip = MockPopup.instances[0]!;
    expect(element.getAttribute("tabindex")).toBe("0");

    expect(tooltip.isOpen()).toBe(false);
    element.dispatchEvent(new FocusEvent("focus"));
    expect(tooltip.isOpen()).toBe(true);
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(tooltip.isOpen()).toBe(false);

    element.dispatchEvent(new FocusEvent("focus"));
    expect(tooltip.isOpen()).toBe(true);
    element.dispatchEvent(new FocusEvent("blur"));
    expect(tooltip.isOpen()).toBe(false);

    // The pointer path is untouched.
    element.dispatchEvent(new MouseEvent("mouseenter"));
    expect(tooltip.isOpen()).toBe(true);
    element.dispatchEvent(new MouseEvent("mouseleave"));
    expect(tooltip.isOpen()).toBe(false);
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

  it("rebuilds the marker instance when `anchor` changes — MapLibre has no live setter for it", async () => {
    const { rerender } = render(
      <MapCanvas>
        <MapMarker longitude={0} latitude={0} anchor="top">
          <MapMarkerContent />
        </MapMarker>
      </MapCanvas>,
    );
    await waitFor(() => {
      expect(MockMarker.instances).toHaveLength(1);
      expect(MockMarker.instances[0]!.options.anchor).toBe("top");
    });

    rerender(
      <MapCanvas>
        <MapMarker longitude={0} latitude={0} anchor="bottom">
          <MapMarkerContent />
        </MapMarker>
      </MapCanvas>,
    );

    await waitFor(() => {
      expect(MockMarker.instances).toHaveLength(2);
      expect(MockMarker.instances[1]!.options.anchor).toBe("bottom");
    });
    // The old instance is detached, not mutated in place.
    expect(MockMarker.instances[0]!.addedTo).toBeNull();
    expect(MockMarker.instances[1]!.addedTo).not.toBeNull();
  });

  it("never touches `document` during the render phase (SSR-safe)", async () => {
    // `renderToStaticMarkup` never runs effects — only the plain render
    // functions — which is exactly the environment a real SSR host runs in.
    // Deleting `document` reproduces that host having none: the old
    // `useMemo`-based marker construction called `document.createElement`
    // straight out of the render function and would throw here.
    const { renderToStaticMarkup } = await import("react-dom/server");
    const originalDocument = globalThis.document;
    // @ts-expect-error -- simulating a server environment with no DOM
    delete globalThis.document;
    try {
      expect(() =>
        renderToStaticMarkup(
          <MapCanvas>
            <MapMarker longitude={0} latitude={0}>
              <MapMarkerContent />
            </MapMarker>
          </MapCanvas>,
        ),
      ).not.toThrow();
    } finally {
      globalThis.document = originalDocument;
    }
  });

  it("keeps a marker hidden at the current tier off the map (showAt)", async () => {
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 348,
      height: 0,
      top: 0,
      left: 0,
      right: 348,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    render(
      <MapCanvas>
        <MapMarker longitude={1} latitude={1} showAt={{ base: true, narrow: false }}>
          <MapMarkerContent />
        </MapMarker>
        <MapMarker longitude={2} latitude={2}>
          <MapMarkerContent />
        </MapMarker>
      </MapCanvas>,
    );
    await waitFor(() => {
      expect(MockMarker.instances).toHaveLength(2);
      expect(MockMarker.instances[1]!.addedTo).not.toBeNull();
    });
    expect(MockMarker.instances[0]!.addedTo).toBeNull();
    spy.mockRestore();
  });

  it("draws its own label at one of eight positions, boxed, with a callout", async () => {
    render(
      <MapCanvas>
        <MapMarker
          longitude={0}
          latitude={0}
          label={{ text: "Hamilton", position: "bottom-left", box: true, callout: true }}
        />
      </MapCanvas>,
    );
    await waitFor(() => expect(MockMarker.instances).toHaveLength(1));
    const el = MockMarker.instances[0]!.element;
    const label = await waitFor(() => {
      const found = el.querySelector<HTMLElement>('[data-slot="map-marker-label"]');
      expect(found).not.toBeNull();
      return found!;
    });
    expect(label).toHaveTextContent("Hamilton");
    expect(label).toHaveAttribute("data-position", "bottom-left");
    expect(label).toHaveClass("bg-background/90");
    expect(label.style.transform).toContain("translate(calc(-100% +");
    expect(el.querySelector('[data-slot="map-marker-callout"] line')).not.toBeNull();
  });
});
