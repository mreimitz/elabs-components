import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { MockMap, MockMarker, MockPopup, resetMaplibreMock } from "../test-utils/maplibre-mock";
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

describe("MapMarker — a draggable marker answers the keyboard (c-4)", () => {
  /** Fires a real key press on the marker element. */
  function press(element: HTMLElement, key: string, shiftKey = false) {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key, shiftKey, bubbles: true }));
  }

  it("takes a tab stop, names its drag and steps in pixels on the arrow keys", async () => {
    const onDragStart = vi.fn();
    const onDrag = vi.fn();
    const onDragEnd = vi.fn();
    render(
      <MapCanvas>
        <MapMarker
          draggable
          latitude={52}
          longitude={13}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
        >
          <MapMarkerContent />
        </MapMarker>
      </MapCanvas>,
    );
    await waitFor(() => expect(MockMarker.instances).toHaveLength(1));
    const marker = MockMarker.instances[0]!;
    const element = marker.getElement();

    // WCAG 2.1.1: MapLibre gives a marker a tab stop only inside `setPopup`,
    // so a popup-less draggable marker had neither one nor a key handler.
    expect(element.getAttribute("tabindex")).toBe("0");
    expect(element.getAttribute("role")).toBe("button");
    expect(element.getAttribute("aria-label")).toMatch(/arrow keys/i);

    // The mock projects 1° to 10 px, so one 8 px step east is +0.8°.
    press(element, "ArrowRight");
    expect(marker.lngLat.lng).toBeCloseTo(13.8, 5);
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDrag).toHaveBeenCalledTimes(1);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
    const settled = onDragEnd.mock.lastCall?.[0] as { lng: number; lat: number };
    expect(settled.lng).toBeCloseTo(13.8, 5);
    expect(settled.lat).toBeCloseTo(52, 5);

    // Shift is the coarse step (40 px = 4°), and north is a SMALLER y.
    press(element, "ArrowUp", true);
    expect(marker.lngLat.lat).toBeCloseTo(56, 5);
  });

  it("names what it moves when the caller says so, and leaves a static marker alone", async () => {
    const { rerender } = render(
      <MapCanvas>
        <MapMarker draggable dragLabel="Depot location" latitude={0} longitude={0}>
          <MapMarkerContent />
        </MapMarker>
      </MapCanvas>,
    );
    await waitFor(() => expect(MockMarker.instances).toHaveLength(1));
    const element = MockMarker.instances[0]!.getElement();
    expect(element.getAttribute("aria-label")).toBe("Depot location");

    // Not draggable → no tab stop and no invented button role.
    rerender(
      <MapCanvas>
        <MapMarker latitude={0} longitude={0}>
          <MapMarkerContent />
        </MapMarker>
      </MapCanvas>,
    );
    await waitFor(() => expect(element.getAttribute("tabindex")).toBeNull());
    expect(element.getAttribute("role")).toBeNull();
  });
});

describe("MapMarker — a label stays inside the map box (c-7, c-8)", () => {
  /** jsdom measures nothing, so both boxes are described explicitly. */
  function stubRect(element: Element, left: number, top: number, width: number, height: number) {
    element.getBoundingClientRect = () =>
      ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
  }

  async function renderLabel(longitude: number, latitude: number) {
    render(
      <MapCanvas>
        <MapMarker
          longitude={longitude}
          latitude={latitude}
          label={{ text: "bottom-right", position: "bottom-right" }}
        />
      </MapCanvas>,
    );
    await waitFor(() => expect(MockMarker.instances).toHaveLength(1));
    const map = MockMap.instances[0]!;
    const label = await waitFor(() => {
      const found = MockMarker.instances[0]!.element.querySelector<HTMLElement>(
        '[data-slot="map-marker-label"]',
      );
      expect(found).not.toBeNull();
      return found!;
    });
    // A 364 x 480 map box — the width the reviewer measured at 380 px.
    stubRect(map.getContainer(), 0, 0, 364, 480);
    return { map, label };
  }

  it("slides a label that would cross the map's edge back inside", async () => {
    // The mock projects 1° to 10 px: [-160, 50] lands at (200, 400), inside.
    const { map, label } = await renderLabel(-160, 50);
    // The measured overflow: the glyph run ran to x = 368.12 in a box 364 wide.
    stubRect(label, 296.89, 169.13, 71.23, 15);
    act(() => map.emit("move"));
    const shift = Number.parseFloat(label.style.translate);
    expect(shift).toBeCloseTo(-8.12, 2);
    expect(296.89 + shift + 71.23).toBeLessThanOrEqual(364);
  });

  it("leaves a label that already fits exactly where it was", async () => {
    const { map, label } = await renderLabel(-160, 50);
    stubRect(label, 120, 200, 71.23, 15);
    act(() => map.emit("move"));
    expect(label.style.translate).toBe("");
  });

  it("hides a label whose own point has left the map box", async () => {
    // [0, 0] projects to (1800, 900) — far outside a 364 x 480 box. A name
    // pinned to the edge beside no marker claims a place you cannot see.
    const { map, label } = await renderLabel(0, 0);
    stubRect(label, 1700, 880, 71.23, 15);
    act(() => map.emit("move"));
    expect(label.style.visibility).toBe("hidden");
  });

  it("clamps a composed MapMarkerLabel too", async () => {
    render(
      <MapCanvas>
        <MapMarker longitude={-160} latitude={50}>
          <MapMarkerContent />
          <MapMarkerLabel position="bottom">Brandenburg Gate</MapMarkerLabel>
        </MapMarker>
      </MapCanvas>,
    );
    await waitFor(() => expect(MockMarker.instances).toHaveLength(1));
    const map = MockMap.instances[0]!;
    const label = await waitFor(() => {
      const found = MockMarker.instances[0]!.element.querySelector<HTMLElement>(
        '[data-slot="map-marker-label"]',
      );
      expect(found).not.toBeNull();
      return found!;
    });
    stubRect(map.getContainer(), 0, 0, 380, 480);
    // The measured rect at 380 px: 54.43 px of the glyph run outside the start edge.
    stubRect(label, -54.43, 294.29, 104.39, 15);
    act(() => map.emit("move"));
    const shift = Number.parseFloat(label.style.translate);
    expect(shift).toBeCloseTo(58.43, 2);
    expect(-54.43 + shift).toBeGreaterThanOrEqual(4);
  });

  // c-10: a marker MapLibre makes focusable (a popup, a keyboard drag) wore
  // the browser's own focus ring instead of the theme's.
  it("gives the marker element the house focus ring", async () => {
    render(
      <MapCanvas>
        <MapMarker longitude={-160} latitude={50}>
          <MapMarkerContent />
        </MapMarker>
      </MapCanvas>,
    );
    await waitFor(() => expect(MockMarker.instances).toHaveLength(1));
    expect(MockMarker.instances[0]!.element.classList.contains("focus-ring")).toBe(true);
  });
});
